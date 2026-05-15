// 챕터 상세 조회 / 수정 / 삭제 API
// GET    /api/stories/[id]/chapters/[chapterId]  — 챕터 상세 조회
// PUT    /api/stories/[id]/chapters/[chapterId]  — 챕터 수정 (소유자 또는 ADMIN)
// DELETE /api/stories/[id]/chapters/[chapterId]  — 챕터 삭제 (소유자 또는 ADMIN)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireAuth, requireOwnerOrAdmin } from "@/lib/rbac";
import { validateChapterUpdate } from "@/lib/validators/chapter";
import { withDynamicHandler } from "@/lib/api-handler";
import {
  chapterDetailSelect,
  serializeChapterDetail,
  ChapterDetailRow,
} from "@/lib/serializers/chapter";

// ─────────────────────────────────────────────
// 공통: 스토리 + 챕터 조회
// ─────────────────────────────────────────────
async function fetchStoryAndChapter(storyId: string, chapterId: string) {
  const [story, chapter] = await Promise.all([
    prisma.story.findUnique({
      where: { id: storyId },
      select: { id: true, authorId: true, visibility: true },
    }),
    prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { id: true, storyId: true, isPublished: true },
    }),
  ]);
  return { story, chapter };
}

// ─────────────────────────────────────────────
// GET /api/stories/[id]/chapters/[chapterId]
// ─────────────────────────────────────────────
export const GET = withDynamicHandler(async (req, context) => {
  const { id: storyId, chapterId } = await context.params;

  // 세션 조회 (인증 없어도 발행된 챕터는 허용)
  const session = await auth();
  const currentUserId = session?.user?.id ?? null;
  const currentUserRole = session?.user?.role ?? "USER";

  const { story, chapter } = await fetchStoryAndChapter(storyId, chapterId);

  // 스토리 없음
  if (!story) {
    return NextResponse.json(
      { error: "스토리를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 챕터 없음 또는 다른 스토리 소속
  if (!chapter || chapter.storyId !== storyId) {
    return NextResponse.json(
      { error: "챕터를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const isOwner = currentUserId === story.authorId;
  const isAdmin = currentUserRole === "ADMIN";

  // 미발행 챕터: 소유자/ADMIN만 접근 허용
  if (!chapter.isPublished && !isOwner && !isAdmin) {
    return NextResponse.json(
      { error: "챕터를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // PRIVATE 스토리: 소유자/ADMIN만 접근 허용
  if (story.visibility === "PRIVATE" && !isOwner && !isAdmin) {
    return NextResponse.json(
      { error: "스토리를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 상세 조회 (content 포함)
  const detail = await prisma.chapter.findUnique({
    where: { id: chapterId },
    select: chapterDetailSelect,
  });

  if (!detail) {
    return NextResponse.json(
      { error: "챕터를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  return NextResponse.json(serializeChapterDetail(detail as ChapterDetailRow));
});

// ─────────────────────────────────────────────
// PUT /api/stories/[id]/chapters/[chapterId]
// ─────────────────────────────────────────────
export const PUT = withDynamicHandler(async (req, context) => {
  const { id: storyId, chapterId } = await context.params;

  // 인증 필수
  const user = await requireAuth();

  const { story, chapter } = await fetchStoryAndChapter(storyId, chapterId);

  // 스토리 없음
  if (!story) {
    return NextResponse.json(
      { error: "스토리를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 챕터 없음 또는 다른 스토리 소속
  if (!chapter || chapter.storyId !== storyId) {
    return NextResponse.json(
      { error: "챕터를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 소유자 또는 ADMIN만 수정 허용
  requireOwnerOrAdmin(story.authorId, user.id, user.role);

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
  const input = validateChapterUpdate(body);

  // 업데이트 데이터 동적 구성 (존재하는 필드만)
  const updateData: {
    title?: string;
    content?: string;
    orderIndex?: number;
    isPublished?: boolean;
  } = {};

  if (input.title !== undefined) updateData.title = input.title;
  if (input.content !== undefined) updateData.content = input.content;
  if (input.orderIndex !== undefined) updateData.orderIndex = input.orderIndex;
  if (input.isPublished !== undefined) updateData.isPublished = input.isPublished;

  const updated = await prisma.chapter.update({
    where: { id: chapterId },
    data: updateData,
    select: chapterDetailSelect,
  });

  return NextResponse.json(serializeChapterDetail(updated as ChapterDetailRow));
});

// ─────────────────────────────────────────────
// DELETE /api/stories/[id]/chapters/[chapterId]
// ─────────────────────────────────────────────
export const DELETE = withDynamicHandler(async (req, context) => {
  const { id: storyId, chapterId } = await context.params;

  // 인증 필수
  const user = await requireAuth();

  const { story, chapter } = await fetchStoryAndChapter(storyId, chapterId);

  // 스토리 없음
  if (!story) {
    return NextResponse.json(
      { error: "스토리를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 챕터 없음 또는 다른 스토리 소속
  if (!chapter || chapter.storyId !== storyId) {
    return NextResponse.json(
      { error: "챕터를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 소유자 또는 ADMIN만 삭제 허용
  requireOwnerOrAdmin(story.authorId, user.id, user.role);

  await prisma.chapter.delete({ where: { id: chapterId } });

  return NextResponse.json({ message: "챕터가 삭제되었습니다." });
});
