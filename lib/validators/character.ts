// 캐릭터 입력값 유효성 검사 유틸리티
// validateCharacterCreate / validateCharacterUpdate
// 검증 실패 시 400 Response를 throw → withHandler가 그대로 반환
import { NextResponse } from "next/server";

// ─────────────────────────────────────────────
// 허용 상수
// ─────────────────────────────────────────────
const CHAR_VISIBILITIES = ["PUBLIC", "PRIVATE", "UNLISTED"] as const;

type CharVisibility = (typeof CHAR_VISIBILITIES)[number];

// ─────────────────────────────────────────────
// 입력 타입
// ─────────────────────────────────────────────
export type CreateCharacterInput = {
  name: string;
  description?: string;
  personality?: string;
  backgroundStory?: string;
  firstMessage?: string;
  avatar?: string;
  tags: string[];
  visibility: CharVisibility;
};

// 업데이트는 모든 필드 선택적
// description/personality/backgroundStory/firstMessage/avatar는 null 허용 (삭제 의미)
export type UpdateCharacterInput = Partial<
  Omit<
    CreateCharacterInput,
    "description" | "personality" | "backgroundStory" | "firstMessage" | "avatar"
  > & {
    description: string | null;
    personality: string | null;
    backgroundStory: string | null;
    firstMessage: string | null;
    avatar: string | null;
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
function validateName(name: unknown): string {
  if (typeof name !== "string" || name.length < 1 || name.length > 50) {
    badRequest("이름은 1~50자여야 합니다.", "name");
  }
  return name;
}

function validateDescription(description: unknown): string {
  if (typeof description !== "string" || description.length > 1000) {
    badRequest("소개는 최대 1000자여야 합니다.", "description");
  }
  return description;
}

function validatePersonality(personality: unknown): string {
  if (typeof personality !== "string" || personality.length > 2000) {
    badRequest("성격 설명은 최대 2000자여야 합니다.", "personality");
  }
  return personality;
}

function validateBackgroundStory(backgroundStory: unknown): string {
  if (typeof backgroundStory !== "string" || backgroundStory.length > 3000) {
    badRequest("배경 이야기는 최대 3000자여야 합니다.", "backgroundStory");
  }
  return backgroundStory;
}

function validateFirstMessage(firstMessage: unknown): string {
  if (typeof firstMessage !== "string" || firstMessage.length > 500) {
    badRequest("첫 인사말은 최대 500자여야 합니다.", "firstMessage");
  }
  return firstMessage;
}

function validateAvatar(avatar: unknown): string {
  if (typeof avatar !== "string" || avatar.length > 500) {
    badRequest("avatar는 최대 500자여야 합니다.", "avatar");
  }
  return avatar;
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

function validateVisibility(visibility: unknown): CharVisibility {
  if (!CHAR_VISIBILITIES.includes(visibility as CharVisibility)) {
    badRequest(
      `visibility는 ${CHAR_VISIBILITIES.join(", ")} 중 하나여야 합니다.`,
      "visibility"
    );
  }
  return visibility as CharVisibility;
}

// ─────────────────────────────────────────────
// 공개 함수
// ─────────────────────────────────────────────

/**
 * 캐릭터 생성 입력값 검증
 * 실패 시 400 NextResponse를 throw
 */
export function validateCharacterCreate(body: unknown): CreateCharacterInput {
  if (typeof body !== "object" || body === null) {
    badRequest("잘못된 요청 형식입니다.");
  }

  const raw = body as Record<string, unknown>;

  // name: 필수
  const name = validateName(raw.name);

  // description: 선택
  let description: string | undefined;
  if (raw.description !== undefined && raw.description !== null) {
    description = validateDescription(raw.description);
  }

  // personality: 선택
  let personality: string | undefined;
  if (raw.personality !== undefined && raw.personality !== null) {
    personality = validatePersonality(raw.personality);
  }

  // backgroundStory: 선택
  let backgroundStory: string | undefined;
  if (raw.backgroundStory !== undefined && raw.backgroundStory !== null) {
    backgroundStory = validateBackgroundStory(raw.backgroundStory);
  }

  // firstMessage: 선택
  let firstMessage: string | undefined;
  if (raw.firstMessage !== undefined && raw.firstMessage !== null) {
    firstMessage = validateFirstMessage(raw.firstMessage);
  }

  // avatar: 선택
  let avatar: string | undefined;
  if (raw.avatar !== undefined && raw.avatar !== null) {
    avatar = validateAvatar(raw.avatar);
  }

  // tags: 선택, 기본 []
  const tags =
    raw.tags === undefined || raw.tags === null
      ? []
      : validateTags(raw.tags);

  // visibility: 선택, 기본 "PUBLIC"
  const visibility =
    raw.visibility === undefined || raw.visibility === null
      ? "PUBLIC"
      : validateVisibility(raw.visibility);

  return {
    name,
    description,
    personality,
    backgroundStory,
    firstMessage,
    avatar,
    tags,
    visibility,
  };
}

/**
 * 캐릭터 수정 입력값 검증
 * 모든 필드 선택적; nullable 필드는 null 허용 (필드 삭제 의미)
 * 실패 시 400 NextResponse를 throw
 */
export function validateCharacterUpdate(body: unknown): UpdateCharacterInput {
  if (typeof body !== "object" || body === null) {
    badRequest("잘못된 요청 형식입니다.");
  }

  const raw = body as Record<string, unknown>;
  const result: UpdateCharacterInput = {};

  if (raw.name !== undefined) {
    result.name = validateName(raw.name);
  }

  if (raw.description !== undefined) {
    // null은 삭제 의미로 허용
    if (raw.description === null) {
      result.description = null;
    } else {
      result.description = validateDescription(raw.description);
    }
  }

  if (raw.personality !== undefined) {
    if (raw.personality === null) {
      result.personality = null;
    } else {
      result.personality = validatePersonality(raw.personality);
    }
  }

  if (raw.backgroundStory !== undefined) {
    if (raw.backgroundStory === null) {
      result.backgroundStory = null;
    } else {
      result.backgroundStory = validateBackgroundStory(raw.backgroundStory);
    }
  }

  if (raw.firstMessage !== undefined) {
    if (raw.firstMessage === null) {
      result.firstMessage = null;
    } else {
      result.firstMessage = validateFirstMessage(raw.firstMessage);
    }
  }

  if (raw.avatar !== undefined) {
    if (raw.avatar === null) {
      result.avatar = null;
    } else {
      result.avatar = validateAvatar(raw.avatar);
    }
  }

  if (raw.tags !== undefined) {
    result.tags = validateTags(raw.tags);
  }

  if (raw.visibility !== undefined) {
    result.visibility = validateVisibility(raw.visibility);
  }

  return result;
}
