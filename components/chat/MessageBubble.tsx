"use client";

import Image from "next/image";

// ─────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────

export type MessageBubbleProps = {
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: string;
  characterName?: string;
  characterAvatar?: string | null;
};

// ─────────────────────────────────────────────
// 마크다운 인라인 파서
// **텍스트** → 회색 이탤릭 (행동·묘사)
// "텍스트"   → 흰색 (대화)
// *텍스트*   → 이탤릭 (내면)
// ─────────────────────────────────────────────

function parseInlineMarkdown(text: string): React.ReactNode[] {
  // 순서 중요: **…** 먼저, 그 다음 "…", 그 다음 *…*
  const pattern = /(\*\*[^*]+\*\*|"[^"]*"|\*[^*]+\*)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  while ((match = pattern.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    if (before) {
      parts.push(<span key={`plain-${keyCounter++}`}>{before}</span>);
    }

    const token = match[0];

    if (token.startsWith("**") && token.endsWith("**")) {
      // **묘사** → 회색 이탤릭
      const inner = token.slice(2, -2);
      parts.push(
        <em key={`bold-${keyCounter++}`} className="text-t2 not-italic">
          {inner}
        </em>
      );
    } else if (token.startsWith('"') && token.endsWith('"')) {
      // "대화" → 흰색
      parts.push(
        <span key={`quote-${keyCounter++}`} className="text-t1">
          {token}
        </span>
      );
    } else if (token.startsWith("*") && token.endsWith("*")) {
      // *내면* → 이탤릭 + 반투명
      const inner = token.slice(1, -1);
      parts.push(
        <em key={`italic-${keyCounter++}`} className="opacity-70">
          {inner}
        </em>
      );
    } else {
      parts.push(<span key={`raw-${keyCounter++}`}>{token}</span>);
    }

    lastIndex = match.index + token.length;
  }

  const tail = text.slice(lastIndex);
  if (tail) {
    parts.push(<span key={`tail-${keyCounter++}`}>{tail}</span>);
  }

  return parts;
}

// ─────────────────────────────────────────────
// 시간 포맷 (HH:mm)
// ─────────────────────────────────────────────

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    const h = d.getHours().toString().padStart(2, "0");
    const m = d.getMinutes().toString().padStart(2, "0");
    return `${h}:${m}`;
  } catch {
    return "";
  }
}

// ─────────────────────────────────────────────
// 아바타 플레이스홀더
// ─────────────────────────────────────────────

function Avatar({
  name,
  avatar,
}: {
  name: string;
  avatar?: string | null;
}) {
  if (avatar) {
    return (
      <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
        <Image
          src={avatar}
          alt={name}
          width={32}
          height={32}
          className="object-cover w-full h-full"
        />
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-red/20 text-red flex items-center justify-center text-xs font-bold shrink-0 select-none">
      {name[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

// ─────────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────────

export function MessageBubble({
  role,
  content,
  createdAt,
  characterName,
  characterAvatar,
}: MessageBubbleProps) {
  const timeStr = formatTime(createdAt);

  // SYSTEM: 중앙 작은 회색 텍스트
  if (role === "SYSTEM") {
    return (
      <div className="flex justify-center px-4 py-1">
        <p className="text-xs text-t2 bg-bg3 rounded-full px-3 py-1">
          {content}
        </p>
      </div>
    );
  }

  // ASSISTANT: 좌측 정렬
  if (role === "ASSISTANT") {
    const name = characterName ?? "캐릭터";
    return (
      <div className="flex flex-col gap-1">
        {/* 이름 */}
        <div className="flex items-center gap-2 pl-10">
          <span className="text-xs text-t2 font-medium">{name}</span>
        </div>
        {/* 아바타 + 말풍선 */}
        <div className="flex items-end gap-2">
          <Avatar name={name} avatar={characterAvatar} />
          <div className="flex flex-col gap-1 max-w-[70%]">
            <div className="bg-bg2 text-t1 rounded-2xl rounded-tl-sm px-4 py-3 leading-relaxed text-sm">
              {parseInlineMarkdown(content)}
            </div>
          </div>
          {timeStr && (
            <span className="text-[10px] text-t2 pb-1 shrink-0">{timeStr}</span>
          )}
        </div>
      </div>
    );
  }

  // USER: 우측 정렬
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-end gap-2">
        {timeStr && (
          <span className="text-[10px] text-t2 pb-1 shrink-0">{timeStr}</span>
        )}
        <div
          className="bg-red/20 text-t1 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[70%] leading-relaxed text-sm"
          style={{ wordBreak: "break-word" }}
        >
          {content.split("\n").map((line, i) => (
            <span key={i}>
              {i > 0 && <br />}
              {line}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
