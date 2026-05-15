// Claude CLI 연동 유틸리티
// child_process.spawn으로 Claude CLI를 호출하여 AI 응답을 반환
// Claude CLI가 이미 로그인된 상태를 가정 (claude auth login 완료)
import { spawn } from "child_process";

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────

export type ClaudeMessage = {
  role: "user" | "assistant";
  content: string;
};

export type ClaudeStreamOptions = {
  systemPrompt: string;
  messages: ClaudeMessage[];
  model?: string; // 사용할 Claude 모델 ID (선택)
  onChunk: (text: string) => void; // 스트리밍 청크 콜백
  onDone: (fullText: string) => void;
  onError: (err: Error) => void;
};

// ─────────────────────────────────────────────
// 내부 상수
// ─────────────────────────────────────────────

const CLAUDE_TIMEOUT_MS = Number(process.env.CLAUDE_TIMEOUT_MS) || 120_000;

/**
 * 대화 이력 배열을 단일 프롬프트 문자열로 조합
 * Claude CLI의 -p 인자로 전달할 텍스트 생성
 */
function buildPromptFromMessages(messages: ClaudeMessage[]): string {
  return messages
    .map((m) => {
      const label = m.role === "user" ? "Human" : "Assistant";
      return `${label}: ${m.content}`;
    })
    .join("\n\n");
}

// ─────────────────────────────────────────────
// 공개 함수: askClaude
// ─────────────────────────────────────────────

/**
 * Claude CLI를 호출하여 단일 응답을 반환 (스트리밍 없음)
 *
 * 내부적으로 `claude --print --no-preamble --system <system> -p <message>` 실행
 * timeout 30초 초과 시 Error("타임아웃") throw
 *
 * @param systemPrompt  시스템 프롬프트 (캐릭터 페르소나 등)
 * @param userMessage   사용자 입력 메시지
 * @param model         사용할 Claude 모델 ID (선택, 없으면 환경변수 CLAUDE_MODEL 사용)
 * @returns             Claude 응답 전체 텍스트
 */
export async function askClaude(
  systemPrompt: string,
  userMessage: string,
  model?: string
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    // CLI 인자 구성
    const args: string[] = ["--print"];

    if (systemPrompt.trim().length > 0) {
      args.push("--system-prompt", systemPrompt);
    }

    args.push("-p", userMessage);

    // 모델 우선순위: 인자 model > 환경변수 CLAUDE_MODEL > CLI 기본값
    const resolvedModel = model ?? process.env.CLAUDE_MODEL;
    if (resolvedModel) {
      args.push("--model", resolvedModel);
    }

    let stdout = "";
    let stderr = "";
    let settled = false;

    const proc = spawn("claude", args, {
      env: process.env,
      // timeout은 spawn 옵션에서 직접 지원하지 않으므로 수동 처리
    });

    // 타임아웃 처리
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        proc.kill("SIGTERM");
        reject(new Error("Claude CLI 타임아웃: 30초 초과"));
      }
    }, CLAUDE_TIMEOUT_MS);

    proc.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    proc.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on("close", (code: number | null) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;

      if (code === 0) {
        resolve(stdout.trim());
      } else {
        const errMsg = stderr.trim() || `Claude CLI 종료 코드: ${code ?? "unknown"}`;
        reject(new Error(`Claude CLI 오류: ${errMsg}`));
      }
    });

    proc.on("error", (err: Error) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;

      // claude 커맨드를 찾을 수 없는 경우 등 OS 레벨 오류
      reject(new Error(`Claude CLI 실행 실패: ${err.message}`));
    });
  });
}

// ─────────────────────────────────────────────
// 공개 함수: streamClaude
// ─────────────────────────────────────────────

/**
 * Claude CLI를 호출하여 스트리밍 방식으로 응답을 받아옴
 *
 * stdout 데이터가 들어올 때마다 onChunk 콜백 호출
 * 완료 시 onDone(전체 텍스트), 오류 시 onError
 *
 * @param options  ClaudeStreamOptions
 */
export async function streamClaude(options: ClaudeStreamOptions): Promise<void> {
  const { systemPrompt, messages, model, onChunk, onDone, onError } = options;

  // 마지막 사용자 메시지를 -p 인자로, 이전 이력은 프롬프트 앞에 붙임
  const lastUserMsg = messages.findLast((m) => m.role === "user");
  const previousMessages = lastUserMsg
    ? messages.slice(0, messages.lastIndexOf(lastUserMsg))
    : messages;

  // 이전 대화 이력이 있으면 컨텍스트로 prepend
  const contextPrefix =
    previousMessages.length > 0
      ? `[이전 대화]\n${buildPromptFromMessages(previousMessages)}\n\n[현재 메시지]\n`
      : "";

  const userMessage = contextPrefix + (lastUserMsg?.content ?? "");

  const args: string[] = ["--print"];

  if (systemPrompt.trim().length > 0) {
    args.push("--system-prompt", systemPrompt);
  }

  args.push("-p", userMessage);

  // 모델 우선순위: 인자 model > 환경변수 CLAUDE_MODEL > CLI 기본값
  const resolvedModel = model ?? process.env.CLAUDE_MODEL;
  if (resolvedModel) {
    args.push("--model", resolvedModel);
  }

  return new Promise<void>((resolve) => {
    let fullText = "";
    let settled = false;

    const proc = spawn("claude", args, { env: process.env });

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        proc.kill("SIGTERM");
        onError(new Error("Claude CLI 타임아웃: 30초 초과"));
        resolve();
      }
    }, CLAUDE_TIMEOUT_MS);

    proc.stdout.on("data", (data: Buffer) => {
      const chunk = data.toString();
      fullText += chunk;
      onChunk(chunk);
    });

    proc.stderr.on("data", (data: Buffer) => {
      // stderr는 로그에만 기록, 응답에는 포함하지 않음
      console.error("[claude] stderr:", data.toString());
    });

    proc.on("close", (code: number | null) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;

      if (code === 0) {
        onDone(fullText.trim());
      } else {
        onError(new Error(`Claude CLI 종료 코드: ${code ?? "unknown"}`));
      }
      resolve();
    });

    proc.on("error", (err: Error) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;

      onError(new Error(`Claude CLI 실행 실패: ${err.message}`));
      resolve();
    });
  });
}
 {
        onDone(fullText.trim());
      } else {
        onError(new Error(`Claude CLI 종료 코드: ${code ?? "unknown"}`));
      }
      resolve();
    });

    proc.on("error", (err: Error) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      onError(new Error(`Claude CLI 실행 실패: ${err.message}`));
      resolve();
    });
  });
}
