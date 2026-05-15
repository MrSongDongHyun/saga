// 챕터 입력값 유효성 검사 유틸리티
// validateChapterCreate / validateChapterUpdate
// 검증 실패 시 400 NextResponse를 throw → withDynamicHandler가 그대로 반환
import { NextResponse } from "next/server";

// ─────────────────────────────────────────────
// 입력 타입
// ─────────────────────────────────────────────
export type CreateChapterInput = {
  title: string;
  content: string;
  orderIndex?: number;
  isPublished?: boolean;
};

export type UpdateChapterInput = {
  title?: string;
  content?: string;
  orderIndex?: number;
  isPublished?: boolean;
};

// ─────────────────────────────────────────────
// 내부 헬퍼: 400 throw
// ─────────────────────────────────────────────
function badRequest(error: string, field?: string): never {
  const body = field ? { error, field } : { error };
  throw NextResponse.json(body, { status: 400 });
}

// ─────────────────────────────────────────────
// 공통 필드 검증
// ─────────────────────────────────────────────
function validateTitle(title: unknown): string {
  if (typeof title !== "string" || title.length < 1 || title.length > 200) {
    badRequest("제목은 1~200자여야 합니다.", "title");
  }
  return title;
}

function validateContent(content: unknown): string {
  if (typeof content !== "string" || content.length > 100000) {
    badRequest("본문은 최대 100000자여야 합니다.", "content");
  }
  return content;
}

function validateOrderIndex(orderIndex: unknown): number {
  if (typeof orderIndex !== "number" || !Number.isInteger(orderIndex) || orderIndex < 0) {
    badRequest("orderIndex는 0 이상의 정수여야 합니다.", "orderIndex");
  }
  return orderIndex;
}

function validateIsPublished(isPublished: unknown): boolean {
  if (typeof isPublished !== "boolean") {
    badRequest("isPublished는 불리언이어야 합니다.", "isPublished");
  }
  return isPublished;
}

// ─────────────────────────────────────────────
// 공개 함수
// ─────────────────────────────────────────────

/**
 * 챕터 생성 입력값 검증
 * 실패 시 400 NextResponse를 throw
 */
export function validateChapterCreate(body: unknown): CreateChapterInput {
  if (typeof body !== "object" || body === null) {
    badRequest("잘못된 요청 형식입니다.");
  }

  const raw = body as Record<string, unknown>;

  // title: 필수
  const title = validateTitle(raw.title);

  // content: 필수 (빈 문자열 허용)
  if (raw.content === undefined || raw.content === null) {
    badRequest("content는 필수입니다.", "content");
  }
  const content = validateContent(raw.content);

  // orderIndex: 선택
  let orderIndex: number | undefined;
  if (raw.orderIndex !== undefined && raw.orderIndex !== null) {
    orderIndex = validateOrderIndex(raw.orderIndex);
  }

  // isPublished: 선택, 기본 false
  let isPublished: boolean | undefined;
  if (raw.isPublished !== undefined && raw.isPublished !== null) {
    isPublished = validateIsPublished(raw.isPublished);
  }

  return { title, content, orderIndex, isPublished };
}

/**
 * 챕터 수정 입력값 검증
 * 모든 필드 선택적
 * 실패 시 400 NextResponse를 throw
 */
export function validateChapterUpdate(body: unknown): UpdateChapterInput {
  if (typeof body !== "object" || body === null) {
    badRequest("잘못된 요청 형식입니다.");
  }

  const raw = body as Record<string, unknown>;
  const result: UpdateChapterInput = {};

  if (raw.title !== undefined) {
    result.title = validateTitle(raw.title);
  }

  if (raw.content !== undefined) {
    result.content = validateContent(raw.content);
  }

  if (raw.orderIndex !== undefined) {
    result.orderIndex = validateOrderIndex(raw.orderIndex);
  }

  if (raw.isPublished !== undefined) {
    result.isPublished = validateIsPublished(raw.isPublished);
  }

  return result;
}
