// 채팅 메시지 목록 조회 / 전송 + AI 응답 API
// GET  /api/chat/sessions/[sessionId]/messages  — 메시지 목록 (본인 세션만)
// POST /api/chat/sessions/[sessionId]/messages  — 메시지 전송 + AI 응답 (본인 세션만)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withDynamicHandler } from "@/lib/api-handler";
import { requireAuth } from "@/lib/rbac";
import { validateSendMessage } from "@/lib/validators/chat";
import { serializeMessage } from "@/lib/serializers/chat";
import {
  buildCharacterSystemPrompt,
  detectKeywords,
  buildKeywordContext,
  buildUserNoteLayer,
} from "@/lib/ai/promptBuilder";
import { askClaude } from "@/lib/ai/claude";
import { buildContextMessages, CONTEXT_WINDOW_SIZE } from "@/lib/memory";

// prisma generate 전까지 keyword 관계를 any 캐스팅으로 접근
// npx prisma generate 실행 후 자동 해결됨
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as unknown as any;

type SessionParams = { sessionId: string };

// ─────────────────────────────────────────────
// 내부 헬퍼: 세션 소유권 확인
// ─────────────────────────────────────────────

async function getOwnedSession(sessionId: string, userId: string) {
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true, characterId: true, model: true },
  });

  if (!session) {
    return null;
  }

  if (session.userId !== userId) {
    return "forbidden" as const;
  }

  return session;
}

// ─────────────────────────────────────────────
// GET /api/chat/sessions/[sessionId]/messages
// ─────────────────────────────────────────────

export const GET = withDynamicHandler<SessionParams>(
  async (req: NextRequest, ctx) => {
    const user = await requireAuth();
    const { sessionId } = await ctx.params;

    if (!sessionId) {
      return NextResponse.json(
        { error: "세션 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const owned = await getOwnedSession(sessionId, user.id);
    if (owned === null) {
      return NextResponse.json(
        { error: "세션을 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    if (owned === "forbidden") {
      return NextResponse.json(
        { error: "이 세션에 접근할 권한이 없습니다." },
        { status: 403 }
      );
    }

    const { searchParams } = req.nextUrl;
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limitRaw = parseInt(searchParams.get("limit") ?? "50", 10) || 50;
    const limit = Math.min(100, Math.max(1, limitRaw));
    const skip = (page - 1) * limit;

    const [messages, total] = await Promise.all([
      prisma.message.findMany({
        where: { sessionId },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.message.count({ where: { sessionId } }),
    ]);

    return NextResponse.json({
      messages: messages.map(serializeMessage),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }
);

// ─────────────────────────────────────────────
// POST /api/chat/sessions/[sessionId]/messages
// ─────────────────────────────────────────────

export const POST = withDynamicHandler<SessionParams>(
  async (req: NextRequest, ctx) => {
    const user = await requireAuth();
    const { sessionId } = await ctx.params;

    if (!sessionId) {
      return NextResponse.json(
        { error: "세션 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const owned = await getOwnedSession(sessionId, user.id);
    if (owned === null) {
      return NextResponse.json(
        { error: "세션을 찾을 수 없습니다." },
        { status: 404 }
      );
    }
    if (owned === "forbidden") {
      return NextResponse.json(
        { error: "이 세션에 접근할 권한이 없습니다." },
        { status: 403 }
      );
    }

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

    const input = validateSendMessage(body);

    // ─────────────────────────────────────────
    // 1. USER 메시지 DB 저장
    // ─────────────────────────────────────────
    const userMessage = await prisma.message.create({
      data: {
        sessionId,
        role: "USER",
        content: input.content,
      },
    });

    // ─────────────────────────────────────────
    // 2. 최근 CONTEXT_WINDOW_SIZE개 메시지 조회 (방금 저장한 것 포함)
    // ─────────────────────────────────────────
    const recentMessages = await prisma.message.findMany({
      where: { sessionId },
      orderBy: { createdAt: "desc" },
      take: CONTEXT_WINDOW_SIZE,
      select: {
        role: true,
        content: true,
        createdAt: true,
      },
    });

    // buildContextMessages는 SYSTEM 제외 + 시간순 정렬 처리
    const contextMessages = buildContextMessages(
      recentMessages.map((m) => ({
        role: m.role as "USER" | "ASSISTANT" | "SYSTEM",
        content: m.content,
        createdAt: m.createdAt,
      }))
    );

    // ─────────────────────────────────────────
    // 3. 캐릭터 정보 + 키워드북 조회 + 시스템 프롬프트 생성
    //    keyword 관계는 db(any) 캐스팅으로 조회 (prisma generate 전 임시)
    // ─────────────────────────────────────────
    const character = await db.character.findUnique({
      where: { id: owned.characterId },
      select: {
        name: true,
        description: true,
        personality: true,
        backgroundStory: true,
        firstMessage: true,
        tags: true,
        keywords: { select: { keyword: true, content: true } },
      },
    }) as {
      name: string;
      description: string | null;
      personality: string | null;
      backgroundStory: string | null;
      firstMessage: string | null;
      tags: string;
      keywords: Array<{ keyword: string; content: string }>;
    } | null;

    if (!character) {
      return NextResponse.json(
        { error: "연결된 캐릭터를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // tags JSON 파싱 (방어 처리)
    let parsedTags: string[] = [];
    try {
      const parsed: unknown = JSON.parse(character.tags);
      if (Array.isArray(parsed)) {
        parsedTags = parsed.filter((t): t is string => typeof t === "string");
      }
    } catch {
      parsedTags = [];
    }

    // 유저노트 (요청 바디에서 선택적으로 수신)
    const userNote =
      typeof (body as Record<string, unknown>).userNote === "string"
        ? ((body as Record<string, unknown>).userNote as string)
        : "";

    // 키워드 감지
    const matchedContents = detectKeywords(input.content, character.keywords);
    const keywordBlock = buildKeywordContext(matchedContents);
    const userNoteBlock = buildUserNoteLayer(userNote);

    let systemPrompt = buildCharacterSystemPrompt({
      name: character.name,
      description: character.description,
      personality: character.personality,
      backgroundStory: character.backgroundStory,
      firstMessage: character.firstMessage,
      tags: parsedTags,
    });

    // 키워드·유저노트 블록을 시스템 프롬프트에 추가
    if (keywordBlock) systemPrompt += `\n\n${keywordBlock}`;
    if (userNoteBlock) systemPrompt += `\n\n${userNoteBlock}`;

    // ─────────────────────────────────────────
    // 4. askClaude 호출
    //    컨텍스트가 있으면 이전 대화를 사용자 메시지에 prepend
    // ─────────────────────────────────────────

    const historyMessages = contextMessages.slice(0, -1);
    let promptText = input.content;

    if (historyMessages.length > 0) {
      const historyText = historyMessages
        .map((m) => {
          const label = m.role === "user" ? "사용자" : character.name;
          return `${label}: ${m.content}`;
        })
        .join("\n");
      promptText = `[이전 대화]\n${historyText}\n\n[현재 메시지]\n사용자: ${input.content}`;
    }

    // owned.model: 세션에 저장된 Claude 모델 ID (기본값 "claude-sonnet-4-6")
    let aiResponseText: string;
    try {
      aiResponseText = await askClaude(systemPrompt, promptText, owned.model);
    } catch (err) {
      console.error("[chat/messages] askClaude 오류:", err);
      const errorMessage = err instanceof Error ? err.message : "알 수 없는 오류";

      return NextResponse.json(
        {
          error: "AI 응답 생성에 실패했습니다.",
          detail: errorMessage,
          userMessage: serializeMessage(userMessage),
        },
        { status: 502 }
      );
    }

    // ─────────────────────────────────────────
    // 5. ASSISTANT 메시지 DB 저장
    // ─────────────────────────────────────────
    const assistantMessage = await prisma.message.create({
      data: {
        sessionId,
        role: "ASSISTANT",
        content: aiResponseText,
      },
    });

    // 세션 updatedAt 갱신
    await prisma.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      userMessage: serializeMessage(userMessage),
      assistantMessage: serializeMessage(assistantMessage),
    });
  }
);
