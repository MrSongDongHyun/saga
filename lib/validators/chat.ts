// 채팅 입력값 유효성 검사 유틸리티
// 실패 시 400 NextResponse를 throw → withHandler가 그대로 반환
import { NextResponse } from "next/server";
import { CLAUDE_MODELS, type ClaudeModelId } from "@/lib/constants/models";

// ─────────────────────────────────────────────
// 입력 타입
// ─────────────────────────────────────────────

export type CreateSessionInput = {
  characterId: string;
  title?: string;
};

export type SendMessageInput = {
  content: string;
};

export type UpdateSessionInput = {
  model?: ClaudeModelId;
  title?: string;
};

// ─────────────────────────────────────────────
// 내부 헬퍼: 400 throw
// ─────────────────────────────────────────────
function badRequest(error: string, field?: string): never {
  const body = field ? { error, field } : { error };
  throw NextResponse.json(body, { status: 400 });
}

// ─────────────────────────────────────────────
// 공개 함수
// ─────────────────────────────────────────────

/**
 * 채팅 세션 생성 입력값 검증
 */
export function validateCreateSession(body: unknown): CreateSessionInput {
  if (typeof body !== "object" || body === null) {
    badRequest("잘못된 요청 형식입니다.");
  }

  const raw = body as Record<string, unknown>;

  // characterId: 필수 문자열
  if (typeof raw.characterId !== "string" || raw.characterId.trim().length === 0) {
    badRequest("캐릭터 ID가 필요합니다.", "characterId");
  }

  // title: 선택, 최대 100자
  let title: string | undefined;
  if (raw.title !== undefined && raw.title !== null) {
    if (typeof raw.title !== "string") {
      badRequest("제목은 문자열이어야 합니다.", "title");
    }
    if ((raw.title as string).length > 100) {
      badRequest("제목은 최대 100자여야 합니다.", "title");
    }
    title = (raw.title as string).trim() || undefined;
  }

  return {
    characterId: (raw.characterId as string).trim(),
    title,
  };
}

/**
 * 메시지 전송 입력값 검증
 */
export function validateSendMessage(body: unknown): SendMessageInput {
  if (typeof body !== "object" || body === null) {
    badRequest("잘못된 요청 형식입니다.");
  }

  const raw = body as Record<string, unknown>;

  if (typeof raw.content !== "string" || raw.content.trim().length === 0) {
    badRequest("메시지 내용이 필요합니다.", "content");
  }

  if ((raw.content as string).length > 4000) {
    badRequest("메시지는 최대 4000자여야 합니다.", "content");
  }

  return { content: (raw.content as string).trim() };
}

/**
 * 채팅 세션 업데이트 입력값 검증
 * model: CLAUDE_MODELS에 포함된 ID여야 함
 */
export function validateUpdateSession(body: unknown): UpdateSessionInput {
  if (typeof body !== "object" || body === null) {
    badRequest("잘못된 요청 형식입니다.");
  }

  const raw = body as Record<string, unknown>;
  const result: UpdateSessionInput = {};

  if (raw.model !== undefined) {
    const validModelIds = CLAUDE_MODELS.map((m) => m.id);
    if (typeof raw.model !== "string" || !(validModelIds as string[]).includes(raw.model)) {
      badRequest(`model은 ${validModelIds.join(", ")} 중 하나여야 합니다.`, "model");
    }
    result.model = raw.model as ClaudeModelId;
  }

  if (raw.title !== undefined) {
    if (typeof raw.title !== "string") {
      badRequest("제목은 문자열이어야 합니다.", "title");
    }
    if ((raw.title as string).length > 100) {
      badRequest("제목은 최대 100자여야 합니다.", "title");
    }
    result.title = (raw.title as string).trim() || undefined;
  }

  return result;
}
