// 챕터 직렬화 유틸리티
// Prisma Chapter 원시 데이터 → API 응답 형태로 변환
import { Prisma } from "@prisma/client";

// ─────────────────────────────────────────────
// Prisma 타입 정의
// ─────────────────────────────────────────────

/** 목록용: content 제외 */
export const chapterSummarySelect = {
  id: true,
  storyId: true,
  title: true,
  orderIndex: true,
  isPublished: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ChapterSelect;

/** 상세용: content 포함 */
export const chapterDetailSelect = {
  id: true,
  storyId: true,
  title: true,
  content: true,
  orderIndex: true,
  isPublished: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ChapterSelect;

export type ChapterSummaryRow = Prisma.ChapterGetPayload<{
  select: typeof chapterSummarySelect;
}>;

export type ChapterDetailRow = Prisma.ChapterGetPayload<{
  select: typeof chapterDetailSelect;
}>;

// ─────────────────────────────────────────────
// 응답 타입
// ─────────────────────────────────────────────

export type ChapterSummary = {
  id: string;
  storyId: string;
  title: string;
  orderIndex: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ChapterDetail = ChapterSummary & {
  content: string;
};

// ─────────────────────────────────────────────
// 직렬화 함수
// ─────────────────────────────────────────────

/** 챕터 요약 직렬화 (목록용, content 미포함) */
export function serializeChapterSummary(raw: ChapterSummaryRow): ChapterSummary {
  return {
    id: raw.id,
    storyId: raw.storyId,
    title: raw.title,
    orderIndex: raw.orderIndex,
    isPublished: raw.isPublished,
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
  };
}

/** 챕터 상세 직렬화 (content 포함) */
export function serializeChapterDetail(raw: ChapterDetailRow): ChapterDetail {
  return {
    id: raw.id,
    storyId: raw.storyId,
    title: raw.title,
    content: raw.content,
    orderIndex: raw.orderIndex,
    isPublished: raw.isPublished,
    createdAt: raw.createdAt.toISOString(),
    updatedAt: raw.updatedAt.toISOString(),
  };
}
