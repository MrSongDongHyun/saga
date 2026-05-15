// 키워드북 API
// GET  /api/characters/[id]/keywords  — 목록 조회 (소유자만)
// POST /api/characters/[id]/keywords  — 키워드 추가 (소유자만)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { withDynamicHandler } from "@/lib/api-handler";

// prisma generate 전까지 keyword 모델을 any 캐스팅으로 접근
// npx prisma generate 실행 후 자동 해결됨
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as unknown as any;

type RouteCtx = { params: Promise<{ id: string }> };

// ─────────────────────────────────────────────
// GET /api/characters/[id]/keywords
// ─────────────────────────────────────────────
export const GET = withDynamicHandler<{ id: string }>(async (_req, ctx) => {
  const { id } = await (ctx as RouteCtx).params;
  const user = await requireAuth();

  const character = await prisma.character.findUnique({
    where: { id },
    select: { creatorId: true },
  });
  if (!character) {
    return NextResponse.json({ error: "캐릭터를 찾을 수 없습니다." }, { status: 404 });
  }
  if (character.creatorId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const keywords = await db.keyword.findMany({
    where: { characterId: id },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ keywords });
});

// ─────────────────────────────────────────────
// POST /api/characters/[id]/keywords
// ─────────────────────────────────────────────
export const POST = withDynamicHandler<{ id: string }>(async (req, ctx) => {
  const { id } = await (ctx as RouteCtx).params;
  const user = await requireAuth();

  const character = await prisma.character.findUnique({
    where: { id },
    select: { creatorId: true },
  });
  if (!character) {
    return NextResponse.json({ error: "캐릭터를 찾을 수 없습니다." }, { status: 404 });
  }
  if (character.creatorId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const keyword = typeof b.keyword === "string" ? b.keyword.trim() : "";
  const content = typeof b.content === "string" ? b.content.trim() : "";

  if (!keyword || !content) {
    return NextResponse.json(
      { error: "keyword와 content는 필수입니다." },
      { status: 400 }
    );
  }
  if (keyword.length > 100) {
    return NextResponse.json({ error: "키워드는 100자 이하입니다." }, { status: 400 });
  }

  const kw = await db.keyword.create({
    data: { characterId: id, keyword, content },
  });

  return NextResponse.json({ keyword: kw }, { status: 201 });
});
