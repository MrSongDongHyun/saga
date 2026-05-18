// PUT    /api/stories/[id]/endings/[endingId]  — 엔딩 수정
// DELETE /api/stories/[id]/endings/[endingId]  — 엔딩 삭제
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { withDynamicHandler } from "@/lib/api-handler";

const VALID_GRADES = ["N", "R", "SR", "SSR"] as const;
const VALID_OPERATORS = ["gt", "gte", "lt", "lte", "eq", "ne"] as const;
type EndingGrade = (typeof VALID_GRADES)[number];
type ConditionOperator = (typeof VALID_OPERATORS)[number];

type EndingConditionInput = {
  statDefId: string;
  operator: ConditionOperator;
  value: number;
  groupId?: number;
};

// ─────────────────────────────────────────────
// PUT /api/stories/[id]/endings/[endingId]
// ─────────────────────────────────────────────
export const PUT = withDynamicHandler(async (req: NextRequest, context) => {
  const { id, endingId } = await context.params;
  const user = await requireAuth();

  const story = await prisma.story.findUnique({ where: { id }, select: { id: true, authorId: true } });
  if (!story) return NextResponse.json({ error: "스토리를 찾을 수 없습니다." }, { status: 404 });
  if (story.authorId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const existing = await prisma.storyEnding.findUnique({ where: { id: endingId } });
  if (!existing || existing.storyId !== id) {
    return NextResponse.json({ error: "엔딩을 찾을 수 없습니다." }, { status: 404 });
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
    if (typeof raw.name !== "string" || raw.name.length < 1 || raw.name.length > 20) {
      return NextResponse.json({ error: "name은 1~20자여야 합니다." }, { status: 400 });
    }
    updateData.name = raw.name;
  }
  if (raw.grade !== undefined) {
    if (!VALID_GRADES.includes(raw.grade as EndingGrade)) {
      return NextResponse.json({ error: `grade는 ${VALID_GRADES.join(", ")} 중 하나여야 합니다.` }, { status: 400 });
    }
    updateData.grade = raw.grade;
  }
  if ("image" in raw) updateData.image = raw.image ?? null;
  if (raw.prompt !== undefined) {
    if (typeof raw.prompt !== "string" || raw.prompt.length > 500) {
      return NextResponse.json({ error: "prompt는 최대 500자여야 합니다." }, { status: 400 });
    }
    updateData.prompt = raw.prompt;
  }
  if ("epilogue" in raw) updateData.epilogue = raw.epilogue ?? null;
  if ("hint" in raw) updateData.hint = raw.hint ?? null;
  if (raw.minTurn !== undefined) { if (typeof raw.minTurn !== "number") return NextResponse.json({ error: "minTurn은 숫자여야 합니다." }, { status: 400 }); updateData.minTurn = raw.minTurn; }
  if (raw.startTurn !== undefined) { if (typeof raw.startTurn !== "number") return NextResponse.json({ error: "startTurn은 숫자여야 합니다." }, { status: 400 }); updateData.startTurn = raw.startTurn; }
  if (raw.sortOrder !== undefined) { if (typeof raw.sortOrder !== "number") return NextResponse.json({ error: "sortOrder는 숫자여야 합니다." }, { status: 400 }); updateData.sortOrder = raw.sortOrder; }

  // 조건 업데이트: 기존 삭제 후 재생성
  let conditions: EndingConditionInput[] | undefined;
  if (raw.conditions !== undefined) {
    if (!Array.isArray(raw.conditions)) {
      return NextResponse.json({ error: "conditions는 배열이어야 합니다." }, { status: 400 });
    }
    conditions = raw.conditions as EndingConditionInput[];
    for (const c of conditions) {
      if (!VALID_OPERATORS.includes(c.operator)) {
        return NextResponse.json({ error: `조건 operator는 ${VALID_OPERATORS.join(", ")} 중 하나여야 합니다.` }, { status: 400 });
      }
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (conditions !== undefined) {
      await tx.endingCondition.deleteMany({ where: { endingId } });
      if (conditions.length > 0) {
        await tx.endingCondition.createMany({
          data: conditions.map((c) => ({
            endingId,
            statDefId: c.statDefId,
            operator: c.operator,
            value: c.value,
            groupId: c.groupId ?? 0,
          })),
        });
      }
    }

    return tx.storyEnding.update({
      where: { id: endingId },
      data: updateData,
      include: { conditions: true },
    });
  });

  return NextResponse.json({ ending: updated });
});

// ─────────────────────────────────────────────
// DELETE /api/stories/[id]/endings/[endingId]
// ─────────────────────────────────────────────
export const DELETE = withDynamicHandler(async (_req: NextRequest, context) => {
  const { id, endingId } = await context.params;
  const user = await requireAuth();

  const story = await prisma.story.findUnique({ where: { id }, select: { id: true, authorId: true } });
  if (!story) return NextResponse.json({ error: "스토리를 찾을 수 없습니다." }, { status: 404 });
  if (story.authorId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const existing = await prisma.storyEnding.findUnique({ where: { id: endingId } });
  if (!existing || existing.storyId !== id) {
    return NextResponse.json({ error: "엔딩을 찾을 수 없습니다." }, { status: 404 });
  }

  await prisma.storyEnding.delete({ where: { id: endingId } });
  return NextResponse.json({ message: "엔딩이 삭제되었습니다." });
});
