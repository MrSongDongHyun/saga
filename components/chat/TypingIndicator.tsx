"use client";

import Image from "next/image";

// ─────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────

type TypingIndicatorProps = {
  characterName: string;
  characterAvatar?: string | null;
};

// ─────────────────────────────────────────────
// 컴포넌트
// ─────────────────────────────────────────────

export function TypingIndicator({
  characterName,
  characterAvatar,
}: TypingIndicatorProps) {
  return (
    <div className="flex flex-col gap-1">
      {/* 이름 */}
      <div className="pl-10">
        <span className="text-xs text-t2 font-medium">{characterName}</span>
      </div>
      {/* 아바타 + 말풍선 */}
      <div className="flex items-end gap-2">
        {/* 아바타 */}
        {characterAvatar ? (
          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0">
            <Image
              src={characterAvatar}
              alt={characterName}
              width={32}
              height={32}
              className="object-cover w-full h-full"
            />
          </div>
        ) : (
          <div className="w-8 h-8 rounded-full bg-red/20 text-red flex items-center justify-center text-xs font-bold shrink-0 select-none">
            {characterName[0]?.toUpperCase() ?? "?"}
          </div>
        )}

        {/* 점 3개 애니메이션 */}
        <div className="bg-bg2 rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
          <span
            className="w-1.5 h-1.5 rounded-full bg-t2 animate-bounce"
            style={{ animationDelay: "0ms", animationDuration: "800ms" }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full bg-t2 animate-bounce"
            style={{ animationDelay: "160ms", animationDuration: "800ms" }}
          />
          <span
            className="w-1.5 h-1.5 rounded-full bg-t2 animate-bounce"
            style={{ animationDelay: "320ms", animationDuration: "800ms" }}
          />
        </div>
      </div>
    </div>
  );
}
