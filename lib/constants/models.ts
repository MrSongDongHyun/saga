// Claude 모델 상수 정의
// 채팅 세션별 모델 선택 기능에서 사용

export type ClaudeModelId =
  | "claude-opus-4-7"
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5-20251001";

export type ClaudeModelOption = {
  id: ClaudeModelId;
  label: string;
  description: string;
};

export const CLAUDE_MODELS: ClaudeModelOption[] = [
  {
    id: "claude-opus-4-7",
    label: "Opus 4.7",
    description: "최고 성능, 복잡한 창작에 적합",
  },
  {
    id: "claude-sonnet-4-6",
    label: "Sonnet 4.6",
    description: "균형 잡힌 성능, 기본 추천",
  },
  {
    id: "claude-haiku-4-5-20251001",
    label: "Haiku 4.5",
    description: "빠른 응답, 간단한 대화에 적합",
  },
];

export const DEFAULT_MODEL: ClaudeModelId = "claude-sonnet-4-6";
