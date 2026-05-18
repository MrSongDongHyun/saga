// 스토리 상세 조회 / 수정 / 삭제 API
// GET    /api/stories/[id]  — 상세 조회
// PUT    /api/stories/[id]  — 수정 (소유자 또는 ADMIN)
// DELETE /api/stories/[id]  — 삭제 (소유자 또는 ADMIN)
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireAuth, requireOwnerOrAdmin } from "@/lib/rbac";
import { validateStoryUpdate } from "@/lib/validators/story";
import { withDynamicHandler } from "@/lib/api-handler";
import {
  serializeStoryDetail,
  storyDetailInclude,
  StoryWithFullRelations,
} from "@/lib/serializers/story";

// ─────────────────────────────────────────────
// 공통: 스토리 상세 조회 (chapters 포함)
// ─────────────────────────────────────────────
async function fetchStoryDetail(id: string): Promise<StoryWithFullRelations | null> {
  return prisma.story.findUnique({
    where: { id },
    include: storyDetailInclude,
  }) as Promise<StoryWithFullRelations | null>;
}

// ─────────────────────────────────────────────
// GET /api/stories/[id]
// ─────────────────────────────────────────────
export const GET = withDynamicHandler(async (req, context) => {
  const { id } = await context.params;

  // 현재 로그인 사용자 조회 (인증 실패해도 공개 스토리는 허용)
  const session = await auth();
  const currentUserId = session?.user?.id ?? null;
  const currentUserRole = session?.user?.role ?? "USER";

  const story = await fetchStoryDetail(id);

  // 스토리 없음
  if (!story) {
    return NextResponse.json(
      { error: "스토리를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // PRIVATE 스토리: 소유자 또는 ADMIN만 접근 허용
  // 타인이 접근하면 404 반환 (존재 노출 방지)
  if (story.visibility === "PRIVATE") {
    const isOwner = currentUserId === story.authorId;
    const isAdmin = currentUserRole === "ADMIN";

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "스토리를 찾을 수 없습니다." },
        { status: 404 }
      );
    }
  }

  // 조회수 원자 증가 + 좋아요/북마크 여부 조회 병렬 실행
  let isLiked: boolean | undefined;
  let isBookmarked: boolean | undefined;

  const incrementPromise = prisma.story.update({
    where: { id },
    data: { viewCount: { increment: 1 } },
    select: { viewCount: true },
  });

  if (currentUserId) {
    const [{ viewCount: updatedViewCount }, likeRecord, bookmarkRecord] =
      await Promise.all([
        incrementPromise,
        prisma.like.findUnique({
          where: { userId_storyId: { userId: currentUserId, storyId: id } },
          select: { id: true },
        }),
        prisma.bookmark.findUnique({
          where: { userId_storyId: { userId: currentUserId, storyId: id } },
          select: { id: true },
        }),
      ]);

    isLiked = likeRecord !== null;
    isBookmarked = bookmarkRecord !== null;

    // increment 후 DB에서 반환된 실제 viewCount 사용
    const storyWithUpdatedView: StoryWithFullRelations = {
      ...story,
      viewCount: updatedViewCount,
    };

    return NextResponse.json(
      serializeStoryDetail(storyWithUpdatedView, { isLiked, isBookmarked })
    );
  }

  const { viewCount: updatedViewCount } = await incrementPromise;

  const storyWithUpdatedView: StoryWithFullRelations = {
    ...story,
    viewCount: updatedViewCount,
  };

  return NextResponse.json(
    serializeStoryDetail(storyWithUpdatedView, { isLiked, isBookmarked })
  );
});

// ─────────────────────────────────────────────
// PUT /api/stories/[id]
// ─────────────────────────────────────────────
export const PUT = withDynamicHandler(async (req, context) => {
  const { id } = await context.params;

  // 인증 필수
  const user = await requireAuth();

  // 대상 스토리 존재 여부 + 소유자 확인
  const existing = await prisma.story.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "스토리를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 소유자 또는 ADMIN만 수정 허용
  requireOwnerOrAdmin(existing.authorId, user.id, user.role);

  // 요청 바디 파싱
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "요청 본문을 파싱할 수 없습니다." },
      { status: 400 }
    );
  }

  // 유효성 검증 (실패 시 400 NextResponse throw)
  const input = validateStoryUpdate(body);

  // Prisma 업데이트 데이터 동적 구성 (존재하는 필드만)
  const updateData: Prisma.StoryUpdateInput = {};

  if (input.title !== undefined) updateData.title = input.title;
  if ("description" in input) updateData.description = input.description ?? null;
  if (input.genre !== undefined) updateData.genre = JSON.stringify(input.genre);
  if (input.tags !== undefined) updateData.tags = JSON.stringify(input.tags);
  if (input.status !== undefined) updateData.status = input.status;
  if (input.visibility !== undefined) updateData.visibility = input.visibility;
  if ("coverImage" in input) updateData.coverImage = input.coverImage ?? null;

  // Phase 1
  if (input.promptTemplate !== undefined) updateData.promptTemplate = input.promptTemplate;
  if ("storyInfo" in input) updateData.storyInfo = input.storyInfo ?? null;
  if (input.exampleDialogs !== undefined) {
    updateData.exampleDialogs = JSON.stringify(input.exampleDialogs);
  }
  if ("prologue" in input) updateData.prologue = input.prologue ?? null;
  if ("startContext" in input) updateData.startContext = input.startContext ?? null;
  if ("playGuide" in input) updateData.playGuide = input.playGuide ?? null;

  // Phase 4
  if ("tagline" in input) updateData.tagline = input.tagline ?? null;
  if (input.hashtags !== undefined) updateData.hashtags = JSON.stringify(input.hashtags);
  if (input.maxOutput !== undefined) updateData.maxOutput = input.maxOutput;
  if (input.isAdult !== undefined) updateData.isAdult = input.isAdult;
  if ("target" in input) updateData.target = input.target ?? null;
  if ("conversationFormat" in input) updateData.conversationFormat = input.conversationFormat ?? null;

  try {
    const updated = await prisma.story.update({
      where: { id },
      data: updateData,
      include: storyDetailInclude,
    });

    return NextResponse.json(
      serializeStoryDetail(updated as StoryWithFullRelations)
    );
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "중복된 데이터가 존재합니다." },
        { status: 400 }
      );
    }
    throw err;
  }
});

// ─────────────────────────────────────────────
// DELETE /api/stories/[id]
// ─────────────────────────────────────────────
export const DELETE = withDynamicHandler(async (req, context) => {
  const { id } = await context.params;

  // 인증 필수
  const user = await requireAuth();

  // 대상 스토리 존재 여부 + 소유자 확인
  const existing = await prisma.story.findUnique({
    where: { id },
    select: { id: true, authorId: true },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "스토리를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 소유자 또는 ADMIN만 삭제 허용
  requireOwnerOrAdmin(existing.authorId, user.id, user.role);

  // Cascade 삭제 (chapters, likes, bookmarks 자동 삭제)
  await prisma.story.delete({ where: { id } });

  return NextResponse.json({ message: "스토리가 삭제되었습니다." });
});
