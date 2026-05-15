// 북마크 토글 / 제거 API
// POST   /api/stories/[id]/bookmark — 북마크 토글 (없으면 추가, 있으면 제거)
// DELETE /api/stories/[id]/bookmark — 북마크 강제 제거
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { withDynamicHandler, assertStoryExists } from "@/lib/api-handler";

// ─────────────────────────────────────────────
// POST /api/stories/[id]/bookmark — 북마크 토글
// ─────────────────────────────────────────────
export const POST = withDynamicHandler(async (_req, context) => {
  const { id } = await context.params;

  // 인증 필수
  const user = await requireAuth();

  // 스토리 존재 여부 확인
  const exists = await assertStoryExists(id);
  if (!exists) {
    return NextResponse.json(
      { error: "스토리를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 기존 북마크 여부 확인
  const existing = await prisma.bookmark.findUnique({
    where: { userId_storyId: { userId: user.id, storyId: id } },
  });

  let bookmarked: boolean;

  if (existing) {
    // 이미 북마크 → 제거 (토글)
    await prisma.bookmark.delete({
      where: { userId_storyId: { userId: user.id, storyId: id } },
    });
    bookmarked = false;
  } else {
    // 북마크 없음 → 추가
    await prisma.bookmark.create({
      data: { userId: user.id, storyId: id },
    });
    bookmarked = true;
  }

  // 현재 북마크 수 조회
  const bookmarkCount = await prisma.bookmark.count({ where: { storyId: id } });

  return NextResponse.json({ bookmarked, bookmarkCount });
});

// ─────────────────────────────────────────────
// DELETE /api/stories/[id]/bookmark — 북마크 강제 제거
// ─────────────────────────────────────────────
export const DELETE = withDynamicHandler(async (_req, context) => {
  const { id } = await context.params;

  // 인증 필수
  const user = await requireAuth();

  // 스토리 존재 여부 확인
  const exists = await assertStoryExists(id);
  if (!exists) {
    return NextResponse.json(
      { error: "스토리를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 북마크 레코드 존재 여부 확인
  const existing = await prisma.bookmark.findUnique({
    where: { userId_storyId: { userId: user.id, storyId: id } },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "북마크한 스토리가 아닙니다." },
      { status: 400 }
    );
  }

  // 북마크 제거
  await prisma.bookmark.delete({
    where: { userId_storyId: { userId: user.id, storyId: id } },
  });

  // 현재 북마크 수 조회
  const bookmarkCount = await prisma.bookmark.count({ where: { storyId: id } });

  return NextResponse.json({ bookmarked: false, bookmarkCount });
});
