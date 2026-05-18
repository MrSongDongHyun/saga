// POST /api/chat/sessions/[sessionId]/stream
// SSE 스트리밍 채팅 응답 API
// chunk 이벤트: { type:"chunk", text:"..." }
// done  이벤트: { type:"done", userMessageId, assistantMessageId }
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { streamClaude } from "@/lib/ai/claude";
import {
  buildCharacterSystemPrompt,
  detectKeywords,
  buildKeywordContext,
  buildUserNoteLayer,
} from "@/lib/ai/promptBuilder";
import { buildContextMessages, CONTEXT_WINDOW_SIZE } from "@/lib/memory";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as unknown as any;

type Params = { sessionId: string };

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<Params> }
) {
  const user = await requireAuth().catch(() => null);
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { sessionId } = await ctx.params;

  // 세션 + 소유권 확인
  const session = await prisma.chatSession.findUnique({
    where: { id: sessionId },
    select: { id: true, userId: true, characterId: true, model: true },
  });
  if (!session) return new Response("Not Found", { status: 404 });
  if (session.userId !== user.id) return new Response("Forbidden", { status: 403 });

  // 요청 바디
  let body: unknown;
  try { body = await req.json(); } catch {
    return new Response("Bad Request", { status: 400 });
  }
  const content =
    typeof (body as Record<string, unknown>).content === "string"
      ? ((body as Record<string, unknown>).content as string).trim()
      : "";
  if (!content) return new Response("content required", { status: 400 });

  const userNote =
    typeof (body as Record<string, unknown>).userNote === "string"
      ? ((body as Record<string, unknown>).userNote as string)
      : "";

  // USER 메시지 DB 저장
  const userMessage = await prisma.message.create({
    data: { sessionId, role: "USER", content },
  });

  // 컨텍스트 메시지 조회
  const recentMessages = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: CONTEXT_WINDOW_SIZE,
    select: { role: true, content: true, createdAt: true },
  });
  const contextMessages = buildContextMessages(
    recentMessages.map((m) => ({
      role: m.role as "USER" | "ASSISTANT" | "SYSTEM",
      content: m.content,
      createdAt: m.createdAt,
    }))
  );

  // 캐릭터 정보 + 키워드
  const character = await db.character.findUnique({
    where: { id: session.characterId },
    select: {
      name: true, description: true, personality: true,
      backgroundStory: true, firstMessage: true, tags: true,
      keywords: { select: { keyword: true, content: true } },
    },
  }) as {
    name: string; description: string | null; personality: string | null;
    backgroundStory: string | null; firstMessage: string | null;
    tags: string; keywords: Array<{ keyword: string; content: string }>;
  } | null;

  if (!character) return new Response("Character not found", { status: 404 });

  let parsedTags: string[] = [];
  try {
    const t: unknown = JSON.parse(character.tags);
    if (Array.isArray(t)) parsedTags = t.filter((x): x is string => typeof x === "string");
  } catch { parsedTags = []; }

  const matchedContents = detectKeywords(content, character.keywords);
  const keywordBlock = buildKeywordContext(matchedContents);
  const userNoteBlock = buildUserNoteLayer(userNote);

  let systemPrompt = buildCharacterSystemPrompt({
    name: character.name, description: character.description,
    personality: character.personality, backgroundStory: character.backgroundStory,
    firstMessage: character.firstMessage, tags: parsedTags,
  });
  if (keywordBlock) systemPrompt += `\n\n${keywordBlock}`;
  if (userNoteBlock) systemPrompt += `\n\n${userNoteBlock}`;

  // 히스토리 prepend
  const historyMessages = contextMessages.slice(0, -1);
  let promptText = content;
  if (historyMessages.length > 0) {
    const historyText = historyMessages
      .map((m) => `${m.role === "user" ? "사용자" : character.name}: ${m.content}`)
      .join("\n");
    promptText = `[이전 대화]\n${historyText}\n\n[현재 메시지]\n사용자: ${content}`;
  }

  // SSE 스트림 반환
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      await streamClaude({
        systemPrompt,
        messages: contextMessages,
        model: session.model,
        onChunk: (chunk) => {
          send({ type: "chunk", text: chunk });
        },
        onDone: async (fullText) => {
          try {
            // ASSISTANT 메시지 DB 저장
            const assistantMessage = await prisma.message.create({
              data: { sessionId, role: "ASSISTANT", content: fullText.trim() },
            });
            await prisma.chatSession.update({
              where: { id: sessionId },
              data: { updatedAt: new Date() },
            });
            send({
              type: "done",
              userMessageId: userMessage.id,
              assistantMessageId: assistantMessage.id,
              assistantContent: fullText.trim(),
              createdAt: assistantMessage.createdAt.toISOString(),
            });
          } catch (e) {
            send({ type: "error", message: String(e) });
          }
          controller.close();
        },
        onError: (err) => {
          send({ type: "error", message: err.message });
          controller.close();
        },
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
