// 플레이 세션 목록 조회 / 생성 API
// GET  /api/play-sessions?limit=10 — 내 플레이 세션 목록 (최근 업데이트순)
// POST /api/play-sessions          — 새 플레이 세션 생성
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withHandler } from "@/lib/api-handler";
import { requireAuth } from "@/lib/rbac";

// ─────────────────────────────────────────────
// GET /api/play-sessions
// ─────────────────────────────────────────────
export const GET = withHandler(async (req: NextRequest) => {
  const user = await requireAuth();

  const { searchParams } = req.nextUrl;
  const limitRaw = parseInt(searchParams.get("limit") ?? "10", 10) || 10;
  const limit = Math.min(50, Math.max(1, limitRaw));

  const sessions = await prisma.playSession.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true,
      storyId: true,
      chapterId: true,
      branchId: true,
      turnCount: true,
      lastMessage: true,
      updatedAt: true,
      story: {
        select: {
          id: true,
          title: true,
          coverImage: true,
        },
      },
    },
  });

  return NextResponse.json({
    sessions: sessions.map((s) => ({
      id: s.id,
      storyId: s.storyId,
      chapterId: s.chapterId,
      branchId: s.branchId,
      turnCount: s.turnCount,
      lastMessage: s.lastMessage,
      updatedAt: s.updatedAt.toISOString(),
      story: {
        id: s.story.id,
        title: s.story.title,
        coverImage: s.story.coverImage,
      },
    })),
  });
});

// ─────────────────────────────────────────────
// POST /api/play-sessions
// ─────────────────────────────────────────────
export const POST = withHandler(async (req: NextRequest) => {
  const user = await requireAuth();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "요청 본문을 파싱할 수 없습니다." },
      { status: 400 }
    );
  }

  // 입력값 검증
  if (
    typeof body !== "object" ||
    body === null ||
    !("storyId" in body) ||
    !("chapterId" in body) ||
    !("playerSetup" in body) ||
    !("charStatus" in body)
  ) {
    return NextResponse.json(
      { error: "storyId, chapterId, playerSetup, charStatus는 필수입니다." },
      { status: 400 }
    );
  }

  const input = body as {
    storyId: string;
    chapterId: string;
    branchId?: string | null;
    playerSetup: Record<string, unknown>;
    charStatus: Record<string, unknown>;
  };

  // 스토리 존재 확인
  const story = await prisma.story.findUnique({
    where: { id: input.storyId },
    select: { id: true },
  });

  if (!story) {
    return NextResponse.json(
      { error: "스토리를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  const session = await prisma.playSession.create({
    data: {
      userId: user.id,
      storyId: input.storyId,
      chapterId: input.chapterId,
      branchId: input.branchId ?? null,
      playerSetup: JSON.stringify(input.playerSetup),
      charStatus: JSON.stringify(input.charStatus),
    },
    select: {
      id: true,
      storyId: true,
      chapterId: true,
      branchId: true,
      turnCount: true,
      lastMessage: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(
    {
      id: session.id,
      storyId: session.storyId,
      chapterId: session.chapterId,
      branchId: session.branchId,
      turnCount: session.turnCount,
      lastMessage: session.lastMessage,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString(),
    },
    { status: 201 }
  );
});
