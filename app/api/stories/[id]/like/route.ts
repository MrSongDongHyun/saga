// 좋아요 토글 / 제거 API
// POST   /api/stories/[id]/like — 좋아요 토글 (없으면 추가, 있으면 제거)
// DELETE /api/stories/[id]/like — 좋아요 강제 제거
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { withDynamicHandler, assertStoryExists } from "@/lib/api-handler";

// ─────────────────────────────────────────────
// POST /api/stories/[id]/like — 좋아요 토글
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

  // 기존 좋아요 여부 확인
  const existing = await prisma.like.findUnique({
    where: { userId_storyId: { userId: user.id, storyId: id } },
  });

  let liked: boolean;

  if (existing) {
    // 이미 좋아요 → 제거 (토글)
    await prisma.like.delete({
      where: { userId_storyId: { userId: user.id, storyId: id } },
    });
    liked = false;
  } else {
    // 좋아요 없음 → 추가
    await prisma.like.create({
      data: { userId: user.id, storyId: id },
    });
    liked = true;
  }

  // 현재 좋아요 수 조회
  const likeCount = await prisma.like.count({ where: { storyId: id } });

  return NextResponse.json({ liked, likeCount });
});

// ─────────────────────────────────────────────
// DELETE /api/stories/[id]/like — 좋아요 강제 제거
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

  // 좋아요 레코드 존재 여부 확인
  const existing = await prisma.like.findUnique({
    where: { userId_storyId: { userId: user.id, storyId: id } },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "좋아요한 스토리가 아닙니다." },
      { status: 400 }
    );
  }

  // 좋아요 제거
  await prisma.like.delete({
    where: { userId_storyId: { userId: user.id, storyId: id } },
  });

  // 현재 좋아요 수 조회
  const likeCount = await prisma.like.count({ where: { storyId: id } });

  return NextResponse.json({ liked: false, likeCount });
});
