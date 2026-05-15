// 스토리 입력값 유효성 검사 유틸리티
// validateStoryCreate / validateStoryUpdate
// 검증 실패 시 400 Response를 throw → withHandler가 그대로 반환
import { NextResponse } from "next/server";

// ─────────────────────────────────────────────
// 허용 상수
// ─────────────────────────────────────────────
const STORY_STATUSES = ["ONGOING", "COMPLETED", "HIATUS"] as const;
const STORY_VISIBILITIES = ["PUBLIC", "PRIVATE", "UNLISTED"] as const;

type StoryStatus = (typeof STORY_STATUSES)[number];
type StoryVisibility = (typeof STORY_VISIBILITIES)[number];

// ─────────────────────────────────────────────
// 입력 타입
// ─────────────────────────────────────────────
export type CreateStoryInput = {
  title: string;
  description?: string;
  genre: string[];
  tags: string[];
  status: StoryStatus;
  visibility: StoryVisibility;
  coverImage?: string;
};

// 업데이트는 모든 필드 선택적, description/coverImage는 null 허용 (삭제 의미)
export type UpdateStoryInput = Partial<
  Omit<CreateStoryInput, "description" | "coverImage"> & {
    description: string | null;
    coverImage: string | null;
  }
>;

// ─────────────────────────────────────────────
// 내부 헬퍼: 400 throw
// ─────────────────────────────────────────────
function badRequest(error: string, field?: string): never {
  const body = field ? { error, field } : { error };
  throw NextResponse.json(body, { status: 400 });
}

// ─────────────────────────────────────────────
// 공통 필드 검증 (create/update 공유)
// ─────────────────────────────────────────────
function validateTitle(title: unknown): string {
  if (typeof title !== "string" || title.length < 1 || title.length > 100) {
    badRequest("제목은 1~100자여야 합니다.", "title");
  }
  return title;
}

function validateDescription(description: unknown): string {
  if (typeof description !== "string" || description.length > 500) {
    badRequest("설명은 최대 500자여야 합니다.", "description");
  }
  return description;
}

function validateGenre(genre: unknown): string[] {
  if (!Array.isArray(genre) || genre.length < 1 || genre.length > 10) {
    badRequest("장르는 1~10개여야 합니다.", "genre");
  }
  for (const g of genre) {
    if (typeof g !== "string" || g.length < 1 || g.length > 20) {
      badRequest("각 장르 항목은 1~20자여야 합니다.", "genre");
    }
  }
  return genre as string[];
}

function validateTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) {
    badRequest("태그는 배열이어야 합니다.", "tags");
  }
  if ((tags as unknown[]).length > 20) {
    badRequest("태그는 최대 20개까지 허용됩니다.", "tags");
  }
  for (const t of tags as unknown[]) {
    if (typeof t !== "string" || t.length < 1 || t.length > 20) {
      badRequest("각 태그 항목은 1~20자여야 합니다.", "tags");
    }
  }
  return tags as string[];
}

function validateStatus(status: unknown): StoryStatus {
  if (!STORY_STATUSES.includes(status as StoryStatus)) {
    badRequest(
      `status는 ${STORY_STATUSES.join(", ")} 중 하나여야 합니다.`,
      "status"
    );
  }
  return status as StoryStatus;
}

function validateVisibility(visibility: unknown): StoryVisibility {
  if (!STORY_VISIBILITIES.includes(visibility as StoryVisibility)) {
    badRequest(
      `visibility는 ${STORY_VISIBILITIES.join(", ")} 중 하나여야 합니다.`,
      "visibility"
    );
  }
  return visibility as StoryVisibility;
}

function validateCoverImage(coverImage: unknown): string {
  if (typeof coverImage !== "string" || coverImage.length > 500) {
    badRequest("coverImage는 최대 500자여야 합니다.", "coverImage");
  }
  return coverImage;
}

// ─────────────────────────────────────────────
// 공개 함수
// ─────────────────────────────────────────────

/**
 * 스토리 생성 입력값 검증
 * 실패 시 400 NextResponse를 throw
 */
export function validateStoryCreate(body: unknown): CreateStoryInput {
  if (typeof body !== "object" || body === null) {
    badRequest("잘못된 요청 형식입니다.");
  }

  const raw = body as Record<string, unknown>;

  // title: 필수
  const title = validateTitle(raw.title);

  // description: 선택
  let description: string | undefined;
  if (raw.description !== undefined && raw.description !== null) {
    description = validateDescription(raw.description);
  }

  // genre: 필수
  const genre = validateGenre(raw.genre);

  // tags: 선택, 기본 []
  const tags =
    raw.tags === undefined || raw.tags === null
      ? []
      : validateTags(raw.tags);

  // status: 선택, 기본 "ONGOING"
  const status =
    raw.status === undefined || raw.status === null
      ? "ONGOING"
      : validateStatus(raw.status);

  // visibility: 선택, 기본 "PUBLIC"
  const visibility =
    raw.visibility === undefined || raw.visibility === null
      ? "PUBLIC"
      : validateVisibility(raw.visibility);

  // coverImage: 선택
  let coverImage: string | undefined;
  if (raw.coverImage !== undefined && raw.coverImage !== null) {
    coverImage = validateCoverImage(raw.coverImage);
  }

  return { title, description, genre, tags, status, visibility, coverImage };
}

/**
 * 스토리 수정 입력값 검증
 * 모든 필드 선택적; description/coverImage는 null 허용 (필드 삭제 의미)
 * 실패 시 400 NextResponse를 throw
 */
export function validateStoryUpdate(body: unknown): UpdateStoryInput {
  if (typeof body !== "object" || body === null) {
    badRequest("잘못된 요청 형식입니다.");
  }

  const raw = body as Record<string, unknown>;
  const result: UpdateStoryInput = {};

  if (raw.title !== undefined) {
    result.title = validateTitle(raw.title);
  }

  if (raw.description !== undefined) {
    // null은 삭제 의미로 허용
    if (raw.description === null) {
      result.description = null;
    } else {
      result.description = validateDescription(raw.description);
    }
  }

  if (raw.genre !== undefined) {
    result.genre = validateGenre(raw.genre);
  }

  if (raw.tags !== undefined) {
    result.tags = validateTags(raw.tags);
  }

  if (raw.status !== undefined) {
    result.status = validateStatus(raw.status);
  }

  if (raw.visibility !== undefined) {
    result.visibility = validateVisibility(raw.visibility);
  }

  if (raw.coverImage !== undefined) {
    // null은 삭제 의미로 허용
    if (raw.coverImage === null) {
      result.coverImage = null;
    } else {
      result.coverImage = validateCoverImage(raw.coverImage);
    }
  }

  return result;
}
