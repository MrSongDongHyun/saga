// 채팅 세션 상세 조회 / 수정 / 삭제 API
// GET    /api/chat/sessions/[sessionId]  — 세션 상세 (본인만)
// PATCH  /api/chat/sessions/[sessionId]  — 세션 타이틀 변경 (본인만)
// DELETE /api/chat/sessions/[sessionId]  — 세션 삭제 (본인만)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDynamicHandler } from "@/lib/api-handler";
import { requireAuth } from "@/lib/rbac";
import { validateUpdateSession } from "@/lib/validators/chat";

type SessionParams = { sessionId: string };

// ─────────────────────────────────────────────
// GET /api/chat/sessions/[sessionId]
// ─────────────────────────────────────────────
export const GET = withDynamicHandler<SessionParams>(
  async (req: NextRequest, ctx) => {
    const user = await requireAuth();
    const { sessionId } = await ctx.params;

    if (!sessionId) {
      return NextResponse.json({ error: "세션 ID가 필요합니다." }, { status: 400 });
    }

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      include: {
        character: {
          select: {
            id: true,
            name: true,
            avatar: true,
            description: true,
            personality: true,
            backgroundStory: true,
            firstMessage: true,
            tags: true,
          },
        },
        _count: { select: { messages: true } },
      },
    });

    if (!session) {
      return NextResponse.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
    }
    if (session.userId !== user.id) {
      return NextResponse.json({ error: "이 세션에 접근할 권한이 없습니다." }, { status: 403 });
    }

    let tags: string[] = [];
    try {
      const parsed: unknown = JSON.parse(session.character.tags);
      if (Array.isArray(parsed)) tags = parsed.filter((t): t is string => typeof t === "string");
    } catch { tags = []; }

    return NextResponse.json({
      id: session.id,
      characterId: session.characterId,
      title: session.title,
      character: {
        id: session.character.id,
        name: session.character.name,
        avatar: session.character.avatar ?? null,
        description: session.character.description ?? null,
        personality: session.character.personality ?? null,
        backgroundStory: session.character.backgroundStory ?? null,
        firstMessage: session.character.firstMessage ?? null,
        tags,
      },
      model: session.model,
      messageCount: session._count.messages,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    });
  }
);

// ─────────────────────────────────────────────
// PATCH /api/chat/sessions/[sessionId]
// ─────────────────────────────────────────────
export const PATCH = withDynamicHandler<SessionParams>(
  async (req: NextRequest, ctx) => {
    const user = await requireAuth();
    const { sessionId } = await ctx.params;

    if (!sessionId) {
      return NextResponse.json({ error: "세션 ID가 필요합니다." }, { status: 400 });
    }

    let body: unknown;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: "요청 본문을 파싱할 수 없습니다." }, { status: 400 });
    }

    const input = validateUpdateSession(body);

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true },
    });
    if (!session) {
      return NextResponse.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
    }
    if (session.userId !== user.id) {
      return NextResponse.json({ error: "이 세션을 수정할 권한이 없습니다." }, { status: 403 });
    }

    const updated = await prisma.chatSession.update({
      where: { id: sessionId },
      data: { title: input.title ?? undefined, model: input.model ?? undefined, updatedAt: new Date() },
    });

    return NextResponse.json({ session: { id: updated.id, title: updated.title } });
  }
);

// ─────────────────────────────────────────────
// DELETE /api/chat/sessions/[sessionId]
// ─────────────────────────────────────────────
export const DELETE = withDynamicHandler<SessionParams>(
  async (_req: NextRequest, ctx) => {
    const user = await requireAuth();
    const { sessionId } = await ctx.params;

    if (!sessionId) {
      return NextResponse.json({ error: "세션 ID가 필요합니다." }, { status: 400 });
    }

    const session = await prisma.chatSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });
    if (!session) {
      return NextResponse.json({ error: "세션을 찾을 수 없습니다." }, { status: 404 });
    }
    if (session.userId !== user.id) {
      return NextResponse.json({ error: "이 세션을 삭제할 권한이 없습니다." }, { status: 403 });
    }

    await prisma.chatSession.delete({ where: { id: sessionId } });

    return NextResponse.json({ ok: true });
  }
);
