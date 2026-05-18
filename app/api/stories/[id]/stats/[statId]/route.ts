// PUT    /api/stories/[id]/stats/[statId]  — 스탯 수정
// DELETE /api/stories/[id]/stats/[statId]  — 스탯 삭제
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { withDynamicHandler } from "@/lib/api-handler";

const VALID_ICONS = ["heart", "star", "circle", "shield", "fire", "sword", "key", "crown", "gem", "bolt"] as const;
const VALID_COLORS = ["red", "orange", "yellow", "green", "blue", "purple", "pink", "teal", "gray"] as const;
type StatIcon = (typeof VALID_ICONS)[number];
type StatColor = (typeof VALID_COLORS)[number];

type StatLevelInput = {
  id?: string; // 기존 레벨 ID (업데이트 시)
  name: string;
  minVal: number;
  maxVal: number;
  prompt?: string;
  sortOrder?: number;
};

// ─────────────────────────────────────────────
// PUT /api/stories/[id]/stats/[statId]
// ─────────────────────────────────────────────
export const PUT = withDynamicHandler(async (req: NextRequest, context) => {
  const { id, statId } = await context.params;
  const user = await requireAuth();

  // 스토리 소유자 확인
  const story = await prisma.story.findUnique({ where: { id }, select: { id: true, authorId: true } });
  if (!story) return NextResponse.json({ error: "스토리를 찾을 수 없습니다." }, { status: 404 });
  if (story.authorId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  // 스탯 존재 확인
  const existing = await prisma.storyStatDef.findUnique({ where: { id: statId } });
  if (!existing || existing.storyId !== id) {
    return NextResponse.json({ error: "스탯을 찾을 수 없습니다." }, { status: 404 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "요청 본문을 파싱할 수 없습니다." }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const updateData: Record<string, unknown> = {};

  if (raw.name !== undefined) {
    if (typeof raw.name !== "string" || raw.name.length < 1 || raw.name.length > 10) {
      return NextResponse.json({ error: "name은 1~10자여야 합니다." }, { status: 400 });
    }
    updateData.name = raw.name;
  }
  if (raw.icon !== undefined) {
    if (!VALID_ICONS.includes(raw.icon as StatIcon)) {
      return NextResponse.json({ error: `icon은 ${VALID_ICONS.join(", ")} 중 하나여야 합니다.` }, { status: 400 });
    }
    updateData.icon = raw.icon;
  }
  if (raw.color !== undefined) {
    if (!VALID_COLORS.includes(raw.color as StatColor)) {
      return NextResponse.json({ error: `color는 ${VALID_COLORS.join(", ")} 중 하나여야 합니다.` }, { status: 400 });
    }
    updateData.color = raw.color;
  }
  if ("unit" in raw) updateData.unit = raw.unit ?? null;
  if (raw.minVal !== undefined) { if (typeof raw.minVal !== "number") return NextResponse.json({ error: "minVal은 숫자여야 합니다." }, { status: 400 }); updateData.minVal = raw.minVal; }
  if (raw.maxVal !== undefined) { if (typeof raw.maxVal !== "number") return NextResponse.json({ error: "maxVal은 숫자여야 합니다." }, { status: 400 }); updateData.maxVal = raw.maxVal; }
  if (raw.defaultVal !== undefined) { if (typeof raw.defaultVal !== "number") return NextResponse.json({ error: "defaultVal은 숫자여야 합니다." }, { status: 400 }); updateData.defaultVal = raw.defaultVal; }
  if (raw.description !== undefined) {
    if (typeof raw.description !== "string" || raw.description.length > 500) {
      return NextResponse.json({ error: "description은 최대 500자여야 합니다." }, { status: 400 });
    }
    updateData.description = raw.description;
  }
  if (raw.sortOrder !== undefined) { if (typeof raw.sortOrder !== "number") return NextResponse.json({ error: "sortOrder는 숫자여야 합니다." }, { status: 400 }); updateData.sortOrder = raw.sortOrder; }

  // 레벨 업데이트: 기존 레벨 삭제 후 재생성 (단순 방식)
  let levels: StatLevelInput[] | undefined;
  if (raw.levels !== undefined) {
    if (!Array.isArray(raw.levels)) {
      return NextResponse.json({ error: "levels는 배열이어야 합니다." }, { status: 400 });
    }
    levels = raw.levels as StatLevelInput[];
  }

  // 트랜잭션으로 업데이트
  const updated = await prisma.$transaction(async (tx) => {
    if (levels !== undefined) {
      // 기존 레벨 삭제
      await tx.statLevel.deleteMany({ where: { statDefId: statId } });
      // 새 레벨 생성
      if (levels.length > 0) {
        await tx.statLevel.createMany({
          data: levels.map((lv, idx) => ({
            statDefId: statId,
            name: lv.name,
            minVal: lv.minVal,
            maxVal: lv.maxVal,
            prompt: lv.prompt ?? "",
            sortOrder: lv.sortOrder ?? idx,
          })),
        });
      }
    }

    return tx.storyStatDef.update({
      where: { id: statId },
      data: updateData,
      include: { levels: { orderBy: { sortOrder: "asc" } } },
    });
  });

  return NextResponse.json({ statDef: updated });
});

// ─────────────────────────────────────────────
// DELETE /api/stories/[id]/stats/[statId]
// ─────────────────────────────────────────────
export const DELETE = withDynamicHandler(async (_req: NextRequest, context) => {
  const { id, statId } = await context.params;
  const user = await requireAuth();

  const story = await prisma.story.findUnique({ where: { id }, select: { id: true, authorId: true } });
  if (!story) return NextResponse.json({ error: "스토리를 찾을 수 없습니다." }, { status: 404 });
  if (story.authorId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const existing = await prisma.storyStatDef.findUnique({ where: { id: statId } });
  if (!existing || existing.storyId !== id) {
    return NextResponse.json({ error: "스탯을 찾을 수 없습니다." }, { status: 404 });
  }

  await prisma.storyStatDef.delete({ where: { id: statId } });
  return NextResponse.json({ message: "스탯이 삭제되었습니다." });
});
