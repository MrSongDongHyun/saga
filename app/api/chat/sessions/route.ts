// 채팅 세션 목록 조회 / 생성 API
// GET  /api/chat/sessions  — 내 세션 목록 (로그인 필요)
// POST /api/chat/sessions  — 세션 생성 (로그인 필요)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withHandler } from "@/lib/api-handler";
import { requireAuth } from "@/lib/rbac";
import { validateCreateSession } from "@/lib/validators/chat";
import {
  serializeSessionSummary,
  sessionListInclude,
  SessionWithListRelations,
} from "@/lib/serializers/chat";

// ─────────────────────────────────────────────
// GET /api/chat/sessions
// ─────────────────────────────────────────────
export const GET = withHandler(async (req: NextRequest) => {
  const user = await requireAuth();

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limitRaw = parseInt(searchParams.get("limit") ?? "20", 10) || 20;
  const limit = Math.min(50, Math.max(1, limitRaw));
  const skip = (page - 1) * limit;

  const [sessions, total] = await Promise.all([
    prisma.chatSession.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      skip,
      take: limit,
      include: sessionListInclude,
    }),
    prisma.chatSession.count({ where: { userId: user.id } }),
  ]);

  return NextResponse.json({
    sessions: (sessions as SessionWithListRelations[]).map(
      serializeSessionSummary
    ),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// ─────────────────────────────────────────────
// POST /api/chat/sessions
// ─────────────────────────────────────────────
export const POST = withHandler(async (req: NextRequest) => {
  const user = await requireAuth();

  // 요청 바디 파싱
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "요청 본문을 파싱할 수 없습니다." },
      { status: 400 }
    );
  }

  const input = validateCreateSession(body);

  // 캐릭터 존재 확인 + 접근 권한 검증
  const character = await prisma.character.findUnique({
    where: { id: input.characterId },
    select: {
      id: true,
      name: true,
      avatar: true,
      visibility: true,
      creatorId: true,
    },
  });

  if (!character) {
    return NextResponse.json(
      { error: "캐릭터를 찾을 수 없습니다.", field: "characterId" },
      { status: 404 }
    );
  }

  // 접근 권한: PUBLIC/UNLISTED는 누구나 가능, PRIVATE는 본인(제작자)만
  if (
    character.visibility === "PRIVATE" &&
    character.creatorId !== user.id
  ) {
    return NextResponse.json(
      { error: "이 캐릭터에 접근할 권한이 없습니다." },
      { status: 403 }
    );
  }

  // 세션 생성
  const session = await prisma.chatSession.create({
    data: {
      userId: user.id,
      characterId: input.characterId,
      title: input.title ?? null,
    },
    select: {
      id: true,
      characterId: true,
      title: true,
      createdAt: true,
      character: {
        select: {
          id: true,
          name: true,
          avatar: true,
        },
      },
    },
  });

  return NextResponse.json(
    {
      id: session.id,
      characterId: session.characterId,
      title: session.title,
      character: {
        id: session.character.id,
        name: session.character.name,
        avatar: session.character.avatar ?? null,
      },
      createdAt: session.createdAt.toISOString(),
    },
    { status: 201 }
  );
});
