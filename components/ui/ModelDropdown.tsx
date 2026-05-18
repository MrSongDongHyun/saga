"use client";

import { useState, useRef, useEffect } from "react";
import { CLAUDE_MODELS, type ClaudeModelId } from "@/lib/constants/models";

type Props = {
  value: ClaudeModelId;
  onChange: (model: ClaudeModelId) => void;
  disabled?: boolean;
};

export function ModelDropdown({ value, onChange, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const current = CLAUDE_MODELS.find((m) => m.id === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      {/* 트리거 버튼 */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className={[
          "flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors",
          open
            ? "bg-bg3 border-red/50 text-t1"
            : "bg-bg3 border-bg3 text-t2 hover:text-t1 hover:border-t2/30",
          "disabled:opacity-40 disabled:cursor-not-allowed",
        ].join(" ")}
        aria-label="AI 모델 선택"
        title="AI 모델 선택"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="3"/>
          <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
        </svg>
        {current?.label ?? "모델"}
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {/* 드롭다운 */}
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-bg2 border border-bg3 rounded-xl shadow-xl z-50 py-1 overflow-hidden">
          {CLAUDE_MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => { onChange(m.id); setOpen(false); }}
              className={[
                "w-full flex flex-col items-start px-3 py-2.5 text-left transition-colors hover:bg-bg3",
                value === m.id ? "bg-red/10" : "",
              ].join(" ")}
            >
              <span className={["text-xs font-semibold", value === m.id ? "text-red" : "text-t1"].join(" ")}>
                {m.label}
                {value === m.id && " ✓"}
              </span>
              <span className="text-xs text-t2 mt-0.5">{m.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
