// 스토리 직렬화 유틸리티
// Prisma Story 원시 데이터 → API 응답 형태로 변환
import { Prisma } from "@prisma/client";

// ─────────────────────────────────────────────
// Prisma include 타입 정의
// ─────────────────────────────────────────────

/** 목록용: 저자 + 집계 카운트 — Route에서 재사용 가능하도록 export */
export const storyListInclude = {
  author: {
    select: {
      id: true,
      nickname: true,
      profileImage: true,
    },
  },
  _count: {
    select: {
      likes: true,
      bookmarks: true,
      chapters: true,
    },
  },
} satisfies Prisma.StoryInclude;

/** 상세용: 저자 + 챕터 + 집계 카운트 — Route에서 재사용 가능하도록 export */
export const storyDetailInclude = {
  author: {
    select: {
      id: true,
      nickname: true,
      profileImage: true,
    },
  },
  chapters: {
    orderBy: { orderIndex: "asc" as const },
    select: {
      id: true,
      title: true,
      orderIndex: true,
      isPublished: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  _count: {
    select: {
      likes: true,
      bookmarks: true,
      chapters: true,
    },
  },
} satisfies Prisma.StoryInclude;

export type StoryWithCountAndAuthor = Prisma.StoryGetPayload<{
  include: typeof storyListInclude;
}>;

export type StoryWithFullRelations = Prisma.StoryGetPayload<{
  include: typeof storyDetailInclude;
}>;

// ─────────────────────────────────────────────
// 응답 타입
// ─────────────────────────────────────────────

export type StoryAuthor = {
  id: string;
  nickname: string;
  profileImage: string | null;
};

export type StoryChapterSummary = {
  id: string;
  title: string;
  orderIndex: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

/** 전개 예시 쌍 */
export type ExampleDialog = {
  user: string;
  ai: string;
};

export type StoryListItem = {
  id: string;
  title: string;
  description: string | null;
  genre: string[];
  tags: string[];
  status: string;
  visibility: string;
  coverImage: string | null;
  viewCount: number;
  likeCount: number;
  bookmarkCount: number;
  chapterCount: number;
  author: StoryAuthor;
  createdAt: string;
  updatedAt: string;
  // Phase 4
  tagline: string | null;
  hashtags: string[];
  isAdult: boolean;
};

export type StoryDetail = StoryListItem & {
  chapters: StoryChapterSummary[];
  isLiked?: boolean;
  isBookmarked?: boolean;
  // Phase 1
  promptTemplate: string;
  storyInfo: string | null;
  exampleDialogs: ExampleDialog[];
  prologue: string | null;
  startContext: string | null;
  playGuide: string | null;
  // Phase 4
  maxOutput: number;
  target: string | null;
  conversationFormat: string | null;
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

/**
 * ExampleDialog 배열 파싱
 * 파싱 실패 시 빈 배열 반환
 */
function safeParseExampleDialogs(raw: string): ExampleDialog[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is ExampleDialog =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as Record<string, unknown>).user === "string" &&
        typeof (item as Record<string, unknown>).ai === "string"
    );
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────
// 직렬화 함수
// ─────────────────────────────────────────────

/**
 * 스토리 목록 항목 직렬화
 * chapters 정보 없음 (성능 최적화)
 */
export function serializeStoryList(raw: StoryWithCountAndAuthor): StoryListItem {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? null,
    genre: safeParseArray(raw.genre),
    tags: safeParseArray(raw.tags),
    status: raw.status,
    visibility: raw.visibility,
    coverImage: raw.coverImage ?? null,
    viewCount: raw.viewCount,
    likeCount: raw._count.likes,
    bookmarkCount: raw._count.bookmarks,
    chapterCount: raw._count.chapters,
    author: {
      id: raw.author.id,
      nickname: raw.author.nickname,
      profileImage: raw.author.profileImage ?? null,
    },
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
    // Phase 4
    tagline: raw.tagline ?? null,
    hashtags: safeParseArray(raw.hashtags),
    isAdult: raw.isAdult,
  };
}

/**
 * 스토리 상세 직렬화
 * chapters, isLiked, isBookmarked 포함
 */
export function serializeStoryDetail(
  raw: StoryWithFullRelations,
  options?: { isLiked?: boolean; isBookmarked?: boolean }
): StoryDetail {
  return {
    id: raw.id,
    title: raw.title,
    description: raw.description ?? null,
    genre: safeParseArray(raw.genre),
    tags: safeParseArray(raw.tags),
    status: raw.status,
    visibility: raw.visibility,
    coverImage: raw.coverImage ?? null,
    viewCount: raw.viewCount,
    likeCount: raw._count.likes,
    bookmarkCount: raw._count.bookmarks,
    chapterCount: raw._count.chapters,
    author: {
      id: raw.author.id,
      nickname: raw.author.nickname,
      profileImage: raw.author.profileImage ?? null,
    },
    chapters: raw.chapters.map((ch) => ({
      id: ch.id,
      title: ch.title,
      orderIndex: ch.orderIndex,
      isPublished: ch.isPublished,
      createdAt: ch.createdAt.toISOString(),
      updatedAt: ch.updatedAt.toISOString(),
    })),
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
    // Phase 1
    promptTemplate: raw.promptTemplate,
    storyInfo: raw.storyInfo ?? null,
    exampleDialogs: safeParseExampleDialogs(raw.exampleDialogs),
    prologue: raw.prologue ?? null,
    startContext: raw.startContext ?? null,
    playGuide: raw.playGuide ?? null,
    // Phase 4
    tagline: raw.tagline ?? null,
    hashtags: safeParseArray(raw.hashtags),
    maxOutput: raw.maxOutput,
    isAdult: raw.isAdult,
    target: raw.target ?? null,
    conversationFormat: raw.conversationFormat ?? null,
    ...(options?.isLiked !== undefined && { isLiked: options.isLiked }),
    ...(options?.isBookmarked !== undefined && {
      isBookmarked: options.isBookmarked,
    }),
  };
}
