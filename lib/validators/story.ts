// 스토리 입력값 유효성 검사 유틸리티
// validateStoryCreate / validateStoryUpdate
// 검증 실패 시 400 Response를 throw → withHandler가 그대로 반환
import { NextResponse } from "next/server";

// ─────────────────────────────────────────────
// 허용 상수
// ─────────────────────────────────────────────
const STORY_STATUSES = ["ONGOING", "COMPLETED", "HIATUS"] as const;
const STORY_VISIBILITIES = ["PUBLIC", "PRIVATE", "UNLISTED"] as const;
const PROMPT_TEMPLATES = ["basic", "roleplay", "simulation", "custom"] as const;
const STORY_TARGETS = ["ALL", "TEEN", "ADULT"] as const;
const CONVERSATION_FORMATS = ["CHAT", "NOVEL", "GAME"] as const;

type StoryStatus = (typeof STORY_STATUSES)[number];
type StoryVisibility = (typeof STORY_VISIBILITIES)[number];
type PromptTemplate = (typeof PROMPT_TEMPLATES)[number];
type StoryTarget = (typeof STORY_TARGETS)[number];
type ConversationFormat = (typeof CONVERSATION_FORMATS)[number];

// ─────────────────────────────────────────────
// 전개 예시 타입
// ─────────────────────────────────────────────
export type ExampleDialogInput = {
  user: string;
  ai: string;
};

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
    // Phase 1
    promptTemplate: PromptTemplate;
    storyInfo: string | null;
    exampleDialogs: ExampleDialogInput[];
    prologue: string | null;
    startContext: string | null;
    playGuide: string | null;
    // Phase 4
    tagline: string | null;
    hashtags: string[];
    maxOutput: number;
    isAdult: boolean;
    target: StoryTarget | null;
    conversationFormat: ConversationFormat | null;
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

function validatePromptTemplate(val: unknown): PromptTemplate {
  if (!PROMPT_TEMPLATES.includes(val as PromptTemplate)) {
    badRequest(
      `promptTemplate은 ${PROMPT_TEMPLATES.join(", ")} 중 하나여야 합니다.`,
      "promptTemplate"
    );
  }
  return val as PromptTemplate;
}

function validateStoryInfo(val: unknown): string {
  if (typeof val !== "string" || val.length > 4000) {
    badRequest("storyInfo는 최대 4000자여야 합니다.", "storyInfo");
  }
  return val;
}

function validateExampleDialogs(val: unknown): ExampleDialogInput[] {
  if (!Array.isArray(val)) {
    badRequest("exampleDialogs는 배열이어야 합니다.", "exampleDialogs");
  }
  if ((val as unknown[]).length > 3) {
    badRequest("exampleDialogs는 최대 3개까지 허용됩니다.", "exampleDialogs");
  }
  for (const item of val as unknown[]) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as Record<string, unknown>).user !== "string" ||
      typeof (item as Record<string, unknown>).ai !== "string"
    ) {
      badRequest(
        "exampleDialogs 각 항목은 {user:string, ai:string} 형식이어야 합니다.",
        "exampleDialogs"
      );
    }
    const dlg = item as Record<string, unknown>;
    if ((dlg.user as string).length > 500 || (dlg.ai as string).length > 500) {
      badRequest("exampleDialogs 각 항목은 500자 이하여야 합니다.", "exampleDialogs");
    }
  }
  return val as ExampleDialogInput[];
}

function validatePrologue(val: unknown): string {
  if (typeof val !== "string" || val.length > 1000) {
    badRequest("prologue는 최대 1000자여야 합니다.", "prologue");
  }
  return val;
}

function validateStartContext(val: unknown): string {
  if (typeof val !== "string" || val.length > 1000) {
    badRequest("startContext는 최대 1000자여야 합니다.", "startContext");
  }
  return val;
}

function validatePlayGuide(val: unknown): string {
  if (typeof val !== "string" || val.length > 500) {
    badRequest("playGuide는 최대 500자여야 합니다.", "playGuide");
  }
  return val;
}

function validateTagline(val: unknown): string {
  if (typeof val !== "string" || val.length > 30) {
    badRequest("tagline은 최대 30자여야 합니다.", "tagline");
  }
  return val;
}

function validateHashtags(val: unknown): string[] {
  if (!Array.isArray(val)) {
    badRequest("hashtags는 배열이어야 합니다.", "hashtags");
  }
  if ((val as unknown[]).length > 30) {
    badRequest("hashtags는 최대 30개까지 허용됩니다.", "hashtags");
  }
  for (const t of val as unknown[]) {
    if (typeof t !== "string" || t.length > 20) {
      badRequest("각 hashtag는 최대 20자여야 합니다.", "hashtags");
    }
  }
  return val as string[];
}

function validateMaxOutput(val: unknown): number {
  if (typeof val !== "number" || val < 256 || val > 8192) {
    badRequest("maxOutput은 256~8192 범위여야 합니다.", "maxOutput");
  }
  return val;
}

function validateTarget(val: unknown): StoryTarget {
  if (!STORY_TARGETS.includes(val as StoryTarget)) {
    badRequest(
      `target은 ${STORY_TARGETS.join(", ")} 중 하나여야 합니다.`,
      "target"
    );
  }
  return val as StoryTarget;
}

function validateConversationFormat(val: unknown): ConversationFormat {
  if (!CONVERSATION_FORMATS.includes(val as ConversationFormat)) {
    badRequest(
      `conversationFormat은 ${CONVERSATION_FORMATS.join(", ")} 중 하나여야 합니다.`,
      "conversationFormat"
    );
  }
  return val as ConversationFormat;
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
    if (raw.coverImage === null) {
      result.coverImage = null;
    } else {
      result.coverImage = validateCoverImage(raw.coverImage);
    }
  }

  // Phase 1
  if (raw.promptTemplate !== undefined) {
    result.promptTemplate = validatePromptTemplate(raw.promptTemplate);
  }

  if (raw.storyInfo !== undefined) {
    if (raw.storyInfo === null) {
      result.storyInfo = null;
    } else {
      result.storyInfo = validateStoryInfo(raw.storyInfo);
    }
  }

  if (raw.exampleDialogs !== undefined) {
    result.exampleDialogs = validateExampleDialogs(raw.exampleDialogs);
  }

  if (raw.prologue !== undefined) {
    if (raw.prologue === null) {
      result.prologue = null;
    } else {
      result.prologue = validatePrologue(raw.prologue);
    }
  }

  if (raw.startContext !== undefined) {
    if (raw.startContext === null) {
      result.startContext = null;
    } else {
      result.startContext = validateStartContext(raw.startContext);
    }
  }

  if (raw.playGuide !== undefined) {
    if (raw.playGuide === null) {
      result.playGuide = null;
    } else {
      result.playGuide = validatePlayGuide(raw.playGuide);
    }
  }

  // Phase 4
  if (raw.tagline !== undefined) {
    if (raw.tagline === null) {
      result.tagline = null;
    } else {
      result.tagline = validateTagline(raw.tagline);
    }
  }

  if (raw.hashtags !== undefined) {
    result.hashtags = validateHashtags(raw.hashtags);
  }

  if (raw.maxOutput !== undefined) {
    result.maxOutput = validateMaxOutput(raw.maxOutput);
  }

  if (raw.isAdult !== undefined) {
    if (typeof raw.isAdult !== "boolean") {
      badRequest("isAdult는 boolean이어야 합니다.", "isAdult");
    }
    result.isAdult = raw.isAdult;
  }

  if (raw.target !== undefined) {
    if (raw.target === null) {
      result.target = null;
    } else {
      result.target = validateTarget(raw.target);
    }
  }

  if (raw.conversationFormat !== undefined) {
    if (raw.conversationFormat === null) {
      result.conversationFormat = null;
    } else {
      result.conversationFormat = validateConversationFormat(raw.conversationFormat);
    }
  }

  return result;
}
