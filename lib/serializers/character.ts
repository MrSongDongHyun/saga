// 캐릭터 직렬화 유틸리티
// Prisma Character 원시 데이터 → API 응답 형태로 변환
import { Prisma } from "@prisma/client";

// ─────────────────────────────────────────────
// Prisma include 타입 정의
// ─────────────────────────────────────────────

/** 목록용: 제작자 + 집계 카운트 */
const characterListInclude = {
  creator: {
    select: {
      id: true,
      nickname: true,
      profileImage: true,
    },
  },
  _count: {
    select: {
      chatSessions: true,
    },
  },
} satisfies Prisma.CharacterInclude;

/** 상세용: 제작자 + 집계 카운트 — Route에서 재사용 가능하도록 export */
export const characterDetailInclude = {
  creator: {
    select: {
      id: true,
      nickname: true,
      profileImage: true,
    },
  },
  _count: {
    select: {
      chatSessions: true,
    },
  },
} satisfies Prisma.CharacterInclude;

export type CharacterWithCountAndCreator = Prisma.CharacterGetPayload<{
  include: typeof characterListInclude;
}>;

export type CharacterWithFullRelations = Prisma.CharacterGetPayload<{
  include: typeof characterDetailInclude;
}>;

// ─────────────────────────────────────────────
// 응답 타입
// ─────────────────────────────────────────────

export type CharacterCreator = {
  id: string;
  nickname: string;
  profileImage: string | null;
};

export type CharacterListItem = {
  id: string;
  name: string;
  description: string | null;
  personality: string | null;
  avatar: string | null;
  tags: string[];
  visibility: string;
  creatorId: string;
  creator: CharacterCreator;
  sessionCount: number;
  createdAt: string;
  updatedAt: string;
};

export type CharacterDetail = CharacterListItem & {
  backgroundStory: string | null;
  firstMessage: string | null;
};

// ─────────────────────────────────────────────
// 내부 헬퍼
// ─────────────────────────────────────────────

/**
 * JSON 문자열 배열 파싱
 * 파싱 실패 시 빈 배열 반환 (방어 코드)
 */
function safeParseArray(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === "string");
    }
    return [];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────
// 직렬화 함수
// ─────────────────────────────────────────────

/**
 * 캐릭터 목록 항목 직렬화
 * backgroundStory, firstMessage 제외 (성능 최적화)
 */
export function serializeCharacterList(
  raw: CharacterWithCountAndCreator
): CharacterListItem {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? null,
    personality: raw.personality ?? null,
    avatar: raw.avatar ?? null,
    tags: safeParseArray(raw.tags),
    visibility: raw.visibility,
    creatorId: raw.creatorId,
    creator: {
      id: raw.creator.id,
      nickname: raw.creator.nickname,
      profileImage: raw.creator.profileImage ?? null,
    },
    sessionCount: raw._count.chatSessions,
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
  };
}

/**
 * 캐릭터 상세 직렬화
 * backgroundStory, firstMessage 포함
 */
export function serializeCharacterDetail(
  raw: CharacterWithFullRelations
): CharacterDetail {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description ?? null,
    personality: raw.personality ?? null,
    backgroundStory: raw.backgroundStory ?? null,
    firstMessage: raw.firstMessage ?? null,
    avatar: raw.avatar ?? null,
    tags: safeParseArray(raw.tags),
    visibility: raw.visibility,
    creatorId: raw.creatorId,
    creator: {
      id: raw.creator.id,
      nickname: raw.creator.nickname,
      profileImage: raw.creator.profileImage ?? null,
    },
    sessionCount: raw._count.chatSessions,
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
  };
}
