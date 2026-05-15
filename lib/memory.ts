// 채팅 메모리 시스템
// 슬라이딩 윈도우 방식으로 최근 N개 메시지를 Claude 컨텍스트로 변환
// 향후 요약 기반 장기 메모리로 확장 가능한 구조

import type { ClaudeMessage } from "@/lib/ai/claude";

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────

/** 컨텍스트 윈도우 크기: 최근 이 개수만큼의 메시지를 포함 */
export const CONTEXT_WINDOW_SIZE = 20;

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────

export type MemoryMessage = {
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: Date;
};

// ─────────────────────────────────────────────
// 공개 함수
// ─────────────────────────────────────────────

/**
 * DB에서 가져온 메시지 배열을 Claude API 형식으로 변환
 *
 * - SYSTEM 역할 메시지는 시스템 프롬프트로 처리하므로 제외
 * - 최근 CONTEXT_WINDOW_SIZE개 메시지만 포함 (슬라이딩 윈도우)
 * - 오래된 순(createdAt 오름차순) 정렬 보장
 *
 * @param messages  DB에서 조회한 메시지 배열 (정렬 순서 무관)
 * @returns         Claude 형식 메시지 배열
 */
export function buildContextMessages(
  messages: MemoryMessage[]
): ClaudeMessage[] {
  // SYSTEM 역할 제외 후 시간순 정렬
  const filtered = messages
    .filter((m) => m.role !== "SYSTEM")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // 슬라이딩 윈도우: 최근 CONTEXT_WINDOW_SIZE개만 사용
  const windowed = filtered.slice(-CONTEXT_WINDOW_SIZE);

  // Claude 형식으로 변환
  return windowed.map((m): ClaudeMessage => ({
    role: m.role === "USER" ? "user" : "assistant",
    content: m.content,
  }));
}

/**
 * 컨텍스트를 단일 문자열 프롬프트로 직렬화
 * (Claude CLI -p 인자 방식에서 이전 대화를 텍스트로 첨부할 때 사용)
 *
 * @param messages  Claude 형식 메시지 배열
 * @returns         대화 이력 텍스트 (빈 배열이면 빈 문자열)
 */
export function serializeContextToText(messages: ClaudeMessage[]): string {
  if (messages.length === 0) return "";

  return messages
    .map((m) => {
      const label = m.role === "user" ? "사용자" : "어시스턴트";
      return `${label}: ${m.content}`;
    })
    .join("\n");
}
