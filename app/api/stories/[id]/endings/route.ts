// GET  /api/stories/[id]/endings  — 엔딩 목록 조회
// POST /api/stories/[id]/endings  — 엔딩 생성
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

type EndingInput = {
  grade?: EndingGrade;
  name: string;
  image?: string;
  prompt?: string;
  epilogue?: string;
  hint?: string;
  minTurn?: number;
  startTurn?: number;
  sortOrder?: number;
  conditions?: EndingConditionInput[];
};

function validateEndingInput(body: unknown): EndingInput | NextResponse {
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "잘못된 요청 형식입니다." }, { status: 400 });
  }
  const raw = body as Record<string, unknown>;

  if (typeof raw.name !== "string" || raw.name.length < 1 || raw.name.length > 20) {
    return NextResponse.json({ error: "name은 1~20자여야 합니다." }, { status: 400 });
  }
  if (raw.grade !== undefined && !VALID_GRADES.includes(raw.grade as EndingGrade)) {
    return NextResponse.json({ error: `grade는 ${VALID_GRADES.join(", ")} 중 하나여야 합니다.` }, { status: 400 });
  }
  if (raw.prompt !== undefined && (typeof raw.prompt !== "string" || raw.prompt.length > 500)) {
    return NextResponse.json({ error: "prompt는 최대 500자여야 합니다." }, { status: 400 });
  }
  if (raw.epilogue !== undefined && raw.epilogue !== null && (typeof raw.epilogue !== "string" || raw.epilogue.length > 1000)) {
    return NextResponse.json({ error: "epilogue는 최대 1000자여야 합니다." }, { status: 400 });
  }
  if (raw.hint !== undefined && raw.hint !== null && (typeof raw.hint !== "string" || raw.hint.length > 20)) {
    return NextResponse.json({ error: "hint는 최대 20자여야 합니다." }, { status: 400 });
  }

  // 조건 검증
  if (raw.conditions !== undefined) {
    if (!Array.isArray(raw.conditions)) {
      return NextResponse.json({ error: "conditions는 배열이어야 합니다." }, { status: 400 });
    }
    for (const c of raw.conditions as unknown[]) {
      if (typeof c !== "object" || c === null) {
        return NextResponse.json({ error: "조건 항목이 유효하지 않습니다." }, { status: 400 });
      }
      const cond = c as Record<string, unknown>;
      if (typeof cond.statDefId !== "string") {
        return NextResponse.json({ error: "조건 statDefId가 유효하지 않습니다." }, { status: 400 });
      }
      if (!VALID_OPERATORS.includes(cond.operator as ConditionOperator)) {
        return NextResponse.json({ error: `조건 operator는 ${VALID_OPERATORS.join(", ")} 중 하나여야 합니다.` }, { status: 400 });
      }
      if (typeof cond.value !== "number") {
        return NextResponse.json({ error: "조건 value는 숫자여야 합니다." }, { status: 400 });
      }
    }
  }

  return raw as unknown as EndingInput;
}

// ─────────────────────────────────────────────
// GET /api/stories/[id]/endings
// ─────────────────────────────────────────────
export const GET = withDynamicHandler(async (_req: NextRequest, context) => {
  const { id } = await context.params;

  const story = await prisma.story.findUnique({ where: { id }, select: { id: true } });
  if (!story) return NextResponse.json({ error: "스토리를 찾을 수 없습니다." }, { status: 404 });

  const endings = await prisma.storyEnding.findMany({
    where: { storyId: id },
    include: { conditions: true },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ endings });
});

// ─────────────────────────────────────────────
// POST /api/stories/[id]/endings
// ─────────────────────────────────────────────
export const POST = withDynamicHandler(async (req: NextRequest, context) => {
  const { id } = await context.params;
  const user = await requireAuth();

  const story = await prisma.story.findUnique({ where: { id }, select: { id: true, authorId: true } });
  if (!story) return NextResponse.json({ error: "스토리를 찾을 수 없습니다." }, { status: 404 });
  if (story.authorId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const count = await prisma.storyEnding.count({ where: { storyId: id } });
  if (count >= 30) return NextResponse.json({ error: "엔딩은 최대 30개까지 허용됩니다." }, { status: 400 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "요청 본문을 파싱할 수 없습니다." }, { status: 400 });
  }

  const validated = validateEndingInput(body);
  if (validated instanceof NextResponse) return validated;

  const { grade, name, image, prompt, epilogue, hint, minTurn, startTurn, sortOrder, conditions } = validated;

  const created = await prisma.storyEnding.create({
    data: {
      storyId: id,
      grade: grade ?? "N",
      name,
      image: image ?? null,
      prompt: prompt ?? "",
      epilogue: epilogue ?? null,
      hint: hint ?? null,
      minTurn: minTurn ?? 10,
      startTurn: startTurn ?? 10,
      sortOrder: sortOrder ?? count,
      conditions: conditions?.length
        ? {
            create: conditions.map((c) => ({
              statDefId: c.statDefId,
              operator: c.operator,
              value: c.value,
              groupId: c.groupId ?? 0,
            })),
          }
        : undefined,
    },
    include: { conditions: true },
  });

  return NextResponse.json({ ending: created }, { status: 201 });
});
