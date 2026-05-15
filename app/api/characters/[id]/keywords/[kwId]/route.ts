// 키워드 수정 / 삭제 API
// PUT    /api/characters/[id]/keywords/[kwId]  — 수정 (소유자만)
// DELETE /api/characters/[id]/keywords/[kwId]  — 삭제 (소유자만)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { withDynamicHandler } from "@/lib/api-handler";

// prisma generate 전까지 keyword 모델을 any 캐스팅으로 접근
// npx prisma generate 실행 후 자동 해결됨
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as unknown as any;

type RouteCtx = { params: Promise<{ id: string; kwId: string }> };

// ─────────────────────────────────────────────
// 소유권 검증 헬퍼
// ─────────────────────────────────────────────
async function assertOwner(characterId: string, kwId: string, userId: string, userRole: string) {
  const character = await prisma.character.findUnique({
    where: { id: characterId },
    select: { creatorId: true },
  });
  if (!character) return "notfound_char" as const;

  if (character.creatorId !== userId && userRole !== "ADMIN") {
    return "forbidden" as const;
  }

  const kw = await db.keyword.findUnique({ where: { id: kwId } });
  if (!kw || kw.characterId !== characterId) return "notfound_kw" as const;

  return "ok" as const;
}

// ─────────────────────────────────────────────
// PUT /api/characters/[id]/keywords/[kwId]
// ─────────────────────────────────────────────
export const PUT = withDynamicHandler<{ id: string; kwId: string }>(
  async (req, ctx) => {
    const { id, kwId } = await (ctx as RouteCtx).params;
    const user = await requireAuth();

    const check = await assertOwner(id, kwId, user.id, user.role);
    if (check === "notfound_char") {
      return NextResponse.json({ error: "캐릭터를 찾을 수 없습니다." }, { status: 404 });
    }
    if (check === "forbidden") {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    if (check === "notfound_kw") {
      return NextResponse.json({ error: "키워드를 찾을 수 없습니다." }, { status: 404 });
    }

    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
    }

    const b = body as Record<string, unknown>;
    const keyword = typeof b.keyword === "string" ? b.keyword.trim() : undefined;
    const content = typeof b.content === "string" ? b.content.trim() : undefined;

    if (keyword !== undefined && keyword.length > 100) {
      return NextResponse.json({ error: "키워드는 100자 이하입니다." }, { status: 400 });
    }

    const updated = await db.keyword.update({
      where: { id: kwId },
      data: {
        ...(keyword !== undefined && { keyword }),
        ...(content !== undefined && { content }),
      },
    });

    return NextResponse.json({ keyword: updated });
  }
);

// ─────────────────────────────────────────────
// DELETE /api/characters/[id]/keywords/[kwId]
// ─────────────────────────────────────────────
export const DELETE = withDynamicHandler<{ id: string; kwId: string }>(
  async (_req, ctx) => {
    const { id, kwId } = await (ctx as RouteCtx).params;
    const user = await requireAuth();

    const check = await assertOwner(id, kwId, user.id, user.role);
    if (check === "notfound_char") {
      return NextResponse.json({ error: "캐릭터를 찾을 수 없습니다." }, { status: 404 });
    }
    if (check === "forbidden") {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    if (check === "notfound_kw") {
      return NextResponse.json({ error: "키워드를 찾을 수 없습니다." }, { status: 404 });
    }

    await db.keyword.delete({ where: { id: kwId } });

    return NextResponse.json({ ok: true });
  }
);
