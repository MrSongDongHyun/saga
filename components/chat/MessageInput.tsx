"use client";

import { useRef, useEffect, useCallback, KeyboardEvent, ChangeEvent } from "react";

// ─────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────

export type MessageInputProps = {
  onSend: (content: string) => void;
  disabled: boolean;
  placeholder?: string;
};

// ─────────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────────

export function MessageInput({
  onSend,
  disabled,
  placeholder = "메시지를 입력하세요...",
}: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // textarea 높이 자동 조절 (최대 5줄)
  function adjustHeight() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    // 한 줄 기본 높이 약 24px, 패딩 포함 최대 5줄 = ~140px
    const maxHeight = 24 * 5 + 32; // lineHeight * maxLines + padding
    el.style.height = Math.min(el.scrollHeight, maxHeight) + "px";
  }

  // disabled 해제 시 포커스
  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus();
    }
  }, [disabled]);

  const handleChange = useCallback((_e: ChangeEvent<HTMLTextAreaElement>) => {
    adjustHeight();
  }, []);

  const handleSend = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    const value = el.value.trim();
    if (!value || disabled) return;

    onSend(value);
    el.value = "";
    el.style.height = "auto";
  }, [disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      // Shift+Enter → 줄바꿈 (기본 동작 허용)
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="border-t border-bg3 p-4 flex gap-3 items-end">
      {/* 텍스트 입력창 */}
      <div className="flex-1 bg-bg3 rounded-2xl px-4 py-3">
        <textarea
          ref={textareaRef}
          rows={1}
          disabled={disabled}
          placeholder={placeholder}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          className={[
            "w-full bg-transparent text-t1 placeholder:text-t2 text-sm",
            "resize-none outline-none leading-6 overflow-y-auto",
            "scrollbar-hide",
            disabled ? "opacity-50 cursor-not-allowed" : "",
          ].join(" ")}
          style={{ maxHeight: `${24 * 5 + 8}px` }}
          aria-label="메시지 입력"
        />
      </div>

      {/* 전송 버튼 */}
      <button
        type="button"
        onClick={handleSend}
        disabled={disabled}
        aria-label="전송"
        className={[
          "shrink-0 w-10 h-10 rounded-2xl flex items-center justify-center transition-all",
          disabled
            ? "bg-red/30 text-red/40 cursor-not-allowed"
            : "bg-red text-white hover:bg-red/90 active:scale-95",
        ].join(" ")}
      >
        {/* 삼각형 전송 아이콘 */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
        </svg>
      </button>
    </div>
  );
}
