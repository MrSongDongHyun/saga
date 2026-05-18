// GET  /api/stories/[id]/stats  — 스탯 목록 조회
// POST /api/stories/[id]/stats  — 스탯 생성
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { withDynamicHandler } from "@/lib/api-handler";

// 아이콘/색상 허용 목록
const VALID_ICONS = ["heart", "star", "circle", "shield", "fire", "sword", "key", "crown", "gem", "bolt"] as const;
const VALID_COLORS = ["red", "orange", "yellow", "green", "blue", "purple", "pink", "teal", "gray"] as const;
type StatIcon = (typeof VALID_ICONS)[number];
type StatColor = (typeof VALID_COLORS)[number];

// 레벨 입력 타입
type StatLevelInput = {
  name: string;
  minVal: number;
  maxVal: number;
  prompt?: string;
  sortOrder?: number;
};

// 스탯 입력 타입
type StatDefInput = {
  name: string;
  icon?: StatIcon;
  color?: StatColor;
  unit?: string;
  minVal?: number;
  maxVal?: number;
  defaultVal?: number;
  description?: string;
  sortOrder?: number;
  levels?: StatLevelInput[];
};

function badRequest(error: string): NextResponse {
  return NextResponse.json({ error }, { status: 400 });
}

function validateStatDefInput(body: unknown): StatDefInput | NextResponse {
  if (typeof body !== "object" || body === null) return badRequest("잘못된 요청 형식입니다.");
  const raw = body as Record<string, unknown>;

  if (typeof raw.name !== "string" || raw.name.length < 1 || raw.name.length > 10) {
    return badRequest("name은 1~10자여야 합니다.");
  }
  if (raw.icon !== undefined && !VALID_ICONS.includes(raw.icon as StatIcon)) {
    return badRequest(`icon은 ${VALID_ICONS.join(", ")} 중 하나여야 합니다.`);
  }
  if (raw.color !== undefined && !VALID_COLORS.includes(raw.color as StatColor)) {
    return badRequest(`color는 ${VALID_COLORS.join(", ")} 중 하나여야 합니다.`);
  }
  if (raw.unit !== undefined && raw.unit !== null && (typeof raw.unit !== "string" || raw.unit.length > 3)) {
    return badRequest("unit은 최대 3자여야 합니다.");
  }
  if (raw.minVal !== undefined && typeof raw.minVal !== "number") return badRequest("minVal은 숫자여야 합니다.");
  if (raw.maxVal !== undefined && typeof raw.maxVal !== "number") return badRequest("maxVal은 숫자여야 합니다.");
  if (raw.defaultVal !== undefined && typeof raw.defaultVal !== "number") return badRequest("defaultVal은 숫자여야 합니다.");
  if (raw.description !== undefined && (typeof raw.description !== "string" || raw.description.length > 500)) {
    return badRequest("description은 최대 500자여야 합니다.");
  }

  // 레벨 검증
  if (raw.levels !== undefined) {
    if (!Array.isArray(raw.levels)) return badRequest("levels는 배열이어야 합니다.");
    for (const lv of raw.levels as unknown[]) {
      if (typeof lv !== "object" || lv === null) return badRequest("levels 항목이 유효하지 않습니다.");
      const lvRaw = lv as Record<string, unknown>;
      if (typeof lvRaw.name !== "string" || lvRaw.name.length < 1 || lvRaw.name.length > 10) {
        return badRequest("레벨 name은 1~10자여야 합니다.");
      }
      if (typeof lvRaw.minVal !== "number" || typeof lvRaw.maxVal !== "number") {
        return badRequest("레벨 minVal/maxVal은 숫자여야 합니다.");
      }
      if (lvRaw.prompt !== undefined && (typeof lvRaw.prompt !== "string" || lvRaw.prompt.length > 100)) {
        return badRequest("레벨 prompt는 최대 100자여야 합니다.");
      }
    }
  }

  return raw as unknown as StatDefInput;
}

// ─────────────────────────────────────────────
// GET /api/stories/[id]/stats
// ─────────────────────────────────────────────
export const GET = withDynamicHandler(async (_req: NextRequest, context) => {
  const { id } = await context.params;

  // 스토리 존재 확인
  const story = await prisma.story.findUnique({ where: { id }, select: { id: true } });
  if (!story) return NextResponse.json({ error: "스토리를 찾을 수 없습니다." }, { status: 404 });

  const statDefs = await prisma.storyStatDef.findMany({
    where: { storyId: id },
    include: { levels: { orderBy: { sortOrder: "asc" } } },
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ statDefs });
});

// ─────────────────────────────────────────────
// POST /api/stories/[id]/stats
// ─────────────────────────────────────────────
export const POST = withDynamicHandler(async (req: NextRequest, context) => {
  const { id } = await context.params;
  const user = await requireAuth();

  // 스토리 소유자 확인
  const story = await prisma.story.findUnique({ where: { id }, select: { id: true, authorId: true } });
  if (!story) return NextResponse.json({ error: "스토리를 찾을 수 없습니다." }, { status: 404 });
  if (story.authorId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  // 스탯 최대 20개 제한
  const count = await prisma.storyStatDef.count({ where: { storyId: id } });
  if (count >= 20) return NextResponse.json({ error: "스탯은 최대 20개까지 허용됩니다." }, { status: 400 });

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "요청 본문을 파싱할 수 없습니다." }, { status: 400 });
  }

  const validated = validateStatDefInput(body);
  if (validated instanceof NextResponse) return validated;

  const { name, icon, color, unit, minVal, maxVal, defaultVal, description, sortOrder, levels } = validated;

  const created = await prisma.storyStatDef.create({
    data: {
      storyId: id,
      name,
      icon: icon ?? "circle",
      color: color ?? "yellow",
      unit: unit ?? null,
      minVal: minVal ?? 0,
      maxVal: maxVal ?? 100,
      defaultVal: defaultVal ?? 50,
      description: description ?? "",
      sortOrder: sortOrder ?? count,
      levels: levels?.length
        ? {
            create: levels.map((lv, idx) => ({
              name: lv.name,
              minVal: lv.minVal,
              maxVal: lv.maxVal,
              prompt: lv.prompt ?? "",
              sortOrder: lv.sortOrder ?? idx,
            })),
          }
        : undefined,
    },
    include: { levels: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ statDef: created }, { status: 201 });
});
