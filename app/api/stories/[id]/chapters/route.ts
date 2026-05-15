// 챕터 목록 조회 / 생성 API
// GET  /api/stories/[id]/chapters  — 챕터 목록 (인증 불필요, PRIVATE 스토리 제외)
// POST /api/stories/[id]/chapters  — 챕터 생성 (소유자 또는 ADMIN)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireAuth, requireOwnerOrAdmin } from "@/lib/rbac";
import { validateChapterCreate } from "@/lib/validators/chapter";
import { withDynamicHandler } from "@/lib/api-handler";
import {
  chapterSummarySelect,
  chapterDetailSelect,
  serializeChapterSummary,
  serializeChapterDetail,
  ChapterSummaryRow,
  ChapterDetailRow,
} from "@/lib/serializers/chapter";

// ─────────────────────────────────────────────
// GET /api/stories/[id]/chapters
// ─────────────────────────────────────────────
export const GET = withDynamicHandler(async (req, context) => {
  const { id: storyId } = await context.params;

  // 세션 조회 (인증 실패해도 공개 스토리는 허용)
  const session = await auth();
  const currentUserId = session?.user?.id ?? null;
  const currentUserRole = session?.user?.role ?? "USER";

  // 스토리 존재 여부 확인
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { id: true, authorId: true, visibility: true },
  });

  if (!story) {
    return NextResponse.json(
      { error: "스토리를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // PRIVATE 스토리: 소유자 또는 ADMIN만 접근 허용
  const isOwner = currentUserId === story.authorId;
  const isAdmin = currentUserRole === "ADMIN";

  if (story.visibility === "PRIVATE" && !isOwner && !isAdmin) {
    return NextResponse.json(
      { error: "스토리를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 챕터 목록 조회
  // 소유자/ADMIN은 미발행 포함 전체, 그 외는 isPublished=true만
  const chapters = await prisma.chapter.findMany({
    where: {
      storyId,
      ...(isOwner || isAdmin ? {} : { isPublished: true }),
    },
    orderBy: { orderIndex: "asc" },
    select: chapterSummarySelect,
  });

  return NextResponse.json({
    chapters: (chapters as ChapterSummaryRow[]).map(serializeChapterSummary),
  });
});

// ─────────────────────────────────────────────
// POST /api/stories/[id]/chapters
// ─────────────────────────────────────────────
export const POST = withDynamicHandler(async (req, context) => {
  const { id: storyId } = await context.params;

  // 인증 필수
  const user = await requireAuth();

  // 스토리 존재 여부 + 소유자 확인
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { id: true, authorId: true },
  });

  if (!story) {
    return NextResponse.json(
      { error: "스토리를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 소유자 또는 ADMIN만 생성 허용
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
  const input = validateChapterCreate(body);

  // orderIndex 미제공 시 기존 챕터 수 + 1로 자동 설정
  let orderIndex = input.orderIndex;
  if (orderIndex === undefined) {
    const count = await prisma.chapter.count({ where: { storyId } });
    orderIndex = count + 1;
  }

  const created = await prisma.chapter.create({
    data: {
      storyId,
      title: input.title,
      content: input.content,
      orderIndex,
      isPublished: input.isPublished ?? false,
    },
    select: chapterDetailSelect,
  });

  return NextResponse.json(
    serializeChapterDetail(created as ChapterDetailRow),
    { status: 201 }
  );
});
