// 채팅 세션 / 메시지 직렬화 유틸리티
// Prisma 원시 데이터 → API 응답 타입으로 변환
import { Prisma } from "@prisma/client";

// ─────────────────────────────────────────────
// Prisma include 타입 정의
// ─────────────────────────────────────────────

/** 세션 목록용: 캐릭터(기본 정보) + 최신 메시지 1개 */
export const sessionListInclude = {
  character: {
    select: {
      id: true,
      name: true,
      avatar: true,
    },
  },
  messages: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
} satisfies Prisma.ChatSessionInclude;

/** 세션 상세용: 캐릭터 전체 정보 포함 */
export const sessionDetailInclude = {
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
} satisfies Prisma.ChatSessionInclude;

export type SessionWithListRelations = Prisma.ChatSessionGetPayload<{
  include: typeof sessionListInclude;
}>;

export type SessionWithDetailRelations = Prisma.ChatSessionGetPayload<{
  include: typeof sessionDetailInclude;
}>;

// ─────────────────────────────────────────────
// 응답 타입
// ─────────────────────────────────────────────

export type MessageItem = {
  id: string;
  sessionId: string;
  role: string; // "USER" | "ASSISTANT" | "SYSTEM"
  content: string;
  createdAt: string;
};

export type SessionCharacterSummary = {
  id: string;
  name: string;
  avatar: string | null;
};

export type SessionSummary = {
  id: string;
  characterId: string;
  title: string | null;
  character: SessionCharacterSummary;
  lastMessage: MessageItem | null;
  createdAt: string;
  updatedAt: string;
};

// ─────────────────────────────────────────────
// 직렬화 함수
// ─────────────────────────────────────────────

/**
 * Prisma Message 원시 데이터 → MessageItem
 */
export function serializeMessage(raw: {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  createdAt: Date;
}): MessageItem {
  return {
    id: raw.id,
    sessionId: raw.sessionId,
    role: raw.role,
    content: raw.content,
    createdAt: raw.createdAt.toISOString(),
  };
}

/**
 * 세션 목록 항목 직렬화
 * lastMessage는 최신 메시지 1개 또는 null
 */
export function serializeSessionSummary(
  raw: SessionWithListRelations
): SessionSummary {
  const lastMsg = raw.messages[0] ?? null;

  return {
    id: raw.id,
    characterId: raw.characterId,
    title: raw.title ?? null,
    character: {
      id: raw.character.id,
      name: raw.character.name,
      avatar: raw.character.avatar ?? null,
    },
    lastMessage: lastMsg ? serializeMessage(lastMsg) : null,
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
  };
}
