// DELETE /api/stories/[id]/media/[mediaId]  — 미디어 삭제
// PUT    /api/stories/[id]/media/[mediaId]  — 분류/상황 수정
import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { withDynamicHandler } from "@/lib/api-handler";

// ─────────────────────────────────────────────
// PUT /api/stories/[id]/media/[mediaId]
// ─────────────────────────────────────────────
export const PUT = withDynamicHandler(async (req: NextRequest, context) => {
  const { id, mediaId } = await context.params;
  const user = await requireAuth();

  const story = await prisma.story.findUnique({ where: { id }, select: { id: true, authorId: true } });
  if (!story) return NextResponse.json({ error: "스토리를 찾을 수 없습니다." }, { status: 404 });
  if (story.authorId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const media = await prisma.storyMedia.findUnique({ where: { id: mediaId } });
  if (!media || media.storyId !== id) {
    return NextResponse.json({ error: "미디어를 찾을 수 없습니다." }, { status: 404 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "요청 본문을 파싱할 수 없습니다." }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const updateData: { category?: string; situation?: string } = {};

  if (raw.category !== undefined) {
    if (typeof raw.category !== "string" || raw.category.length < 1 || raw.category.length > 20) {
      return NextResponse.json({ error: "분류는 1~20자여야 합니다." }, { status: 400 });
    }
    if ((raw.category as string).includes("/") || (raw.category as string).includes("\\")) {
      return NextResponse.json({ error: "분류에 슬래시(/)를 사용할 수 없습니다." }, { status: 400 });
    }
    updateData.category = raw.category.trim();
  }
  if (raw.situation !== undefined) {
    if (typeof raw.situation !== "string" || raw.situation.length < 1 || raw.situation.length > 20) {
      return NextResponse.json({ error: "상황은 1~20자여야 합니다." }, { status: 400 });
    }
    if ((raw.situation as string).includes("/") || (raw.situation as string).includes("\\")) {
      return NextResponse.json({ error: "상황에 슬래시(/)를 사용할 수 없습니다." }, { status: 400 });
    }
    updateData.situation = raw.situation.trim();
  }

  const updated = await prisma.storyMedia.update({
    where: { id: mediaId },
    data: updateData,
  });

  return NextResponse.json({ media: updated });
});

// ─────────────────────────────────────────────
// DELETE /api/stories/[id]/media/[mediaId]
// ─────────────────────────────────────────────
export const DELETE = withDynamicHandler(async (_req: NextRequest, context) => {
  const { id, mediaId } = await context.params;
  const user = await requireAuth();

  const story = await prisma.story.findUnique({ where: { id }, select: { id: true, authorId: true } });
  if (!story) return NextResponse.json({ error: "스토리를 찾을 수 없습니다." }, { status: 404 });
  if (story.authorId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const media = await prisma.storyMedia.findUnique({ where: { id: mediaId } });
  if (!media || media.storyId !== id) {
    return NextResponse.json({ error: "미디어를 찾을 수 없습니다." }, { status: 404 });
  }

  // 파일 시스템에서 삭제
  const filePath = path.join(process.cwd(), "public", media.imageUrl);
  if (existsSync(filePath)) {
    try { await unlink(filePath); } catch { /* 파일 없어도 DB는 삭제 */ }
  }

  await prisma.storyMedia.delete({ where: { id: mediaId } });

  return NextResponse.json({ message: "미디어가 삭제되었습니다." });
});
