// 플레이 세션 상세 조회 / 업데이트 API
// GET   /api/play-sessions/[id] — 세션 상세 (메시지 포함)
// PATCH /api/play-sessions/[id] — 세션 업데이트 (상태, 메시지 추가)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDynamicHandler } from "@/lib/api-handler";
import { requireAuth } from "@/lib/rbac";

// ─────────────────────────────────────────────
// GET /api/play-sessions/[id]
// ─────────────────────────────────────────────
export const GET = withDynamicHandler<{ id: string }>(
  async (req: NextRequest, context) => {
    const user = await requireAuth();
    const { id } = await context.params;

    const session = await prisma.playSession.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: "세션을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 본인 세션인지 확인
    if (session.userId !== user.id) {
      return NextResponse.json(
        { error: "접근 권한이 없습니다." },
        { status: 403 }
      );
    }

    return NextResponse.json({
      session: {
        id: session.id,
        userId: session.userId,
        storyId: session.storyId,
        chapterId: session.chapterId,
        branchId: session.branchId,
        playerSetup: session.playerSetup,
        charStatus: session.charStatus,
        turnCount: session.turnCount,
        lastMessage: session.lastMessage,
        createdAt: session.createdAt.toISOString(),
        updatedAt: session.updatedAt.toISOString(),
        messages: session.messages.map((m) => ({
          id: m.id,
          sessionId: m.sessionId,
          role: m.role,
          content: m.content,
          choices: m.choices,
          createdAt: m.createdAt.toISOString(),
        })),
      },
    });
  }
);

// ─────────────────────────────────────────────
// PATCH /api/play-sessions/[id]
// ─────────────────────────────────────────────
export const PATCH = withDynamicHandler<{ id: string }>(
  async (req: NextRequest, context) => {
    const user = await requireAuth();
    const { id } = await context.params;

    // 본인 세션인지 확인
    const existing = await prisma.playSession.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "세션을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    if (existing.userId !== user.id) {
      return NextResponse.json(
        { error: "접근 권한이 없습니다." },
        { status: 403 }
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "요청 본문을 파싱할 수 없습니다." },
        { status: 400 }
      );
    }

    if (typeof body !== "object" || body === null) {
      return NextResponse.json(
        { error: "잘못된 요청 형식입니다." },
        { status: 400 }
      );
    }

    const input = body as {
      charStatus?: Record<string, unknown>;
      playerSetup?: Record<string, unknown>;
      turnCount?: number;
      lastMessage?: string;
      messages?: Array<{
        role: string;
        content: string;
        choices?: string[];
      }>;
    };

    // 세션 업데이트 데이터 조립
    const updateData: {
      charStatus?: string;
      playerSetup?: string;
      turnCount?: number;
      lastMessage?: string;
    } = {};

    if (input.charStatus !== undefined) {
      updateData.charStatus = JSON.stringify(input.charStatus);
    }
    if (input.playerSetup !== undefined) {
      updateData.playerSetup = JSON.stringify(input.playerSetup);
    }
    if (typeof input.turnCount === "number") {
      updateData.turnCount = input.turnCount;
    }
    if (typeof input.lastMessage === "string") {
      updateData.lastMessage = input.lastMessage.slice(0, 100);
    }

    // 세션 업데이트 + 메시지 생성을 트랜잭션으로 처리
    await prisma.$transaction(async (tx) => {
      await tx.playSession.update({
        where: { id },
        data: updateData,
      });

      if (input.messages && input.messages.length > 0) {
        await tx.playMessage.createMany({
          data: input.messages.map((m) => ({
            sessionId: id,
            role: m.role,
            content: m.content,
            choices: m.choices ? JSON.stringify(m.choices) : null,
          })),
        });
      }
    });

    return NextResponse.json({ ok: true });
  }
);
