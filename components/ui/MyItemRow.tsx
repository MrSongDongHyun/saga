"use client";

// 내 작품 목록 아이템 행 컴포넌트
import Image from "next/image";
import Link from "next/link";

export type MyItemRowProps = {
  id: string;
  title: string;
  coverImage?: string | null;
  visibility: string;
  meta?: string;
  editHref: string;
  onDelete: () => void;
};

const VISIBILITY_STYLE: Record<string, string> = {
  PUBLIC: "bg-green-600/20 text-green-400 border border-green-600/30",
  PRIVATE: "bg-bg3 text-t2 border border-t2/20",
  UNLISTED: "bg-yellow-600/20 text-yellow-400 border border-yellow-600/30",
};
const VISIBILITY_LABEL: Record<string, string> = {
  PUBLIC: "공개",
  PRIVATE: "비공개",
  UNLISTED: "일부 공개",
};

export function MyItemRow({
  title,
  coverImage,
  visibility,
  meta,
  editHref,
  onDelete,
}: MyItemRowProps) {
  const badgeStyle = VISIBILITY_STYLE[visibility] ?? "bg-bg3 text-t2 border border-t2/20";
  const badgeLabel = VISIBILITY_LABEL[visibility] ?? visibility;

  return (
    <div className="flex items-center gap-3 md:gap-4 bg-bg2 rounded-xl px-3 md:px-4 py-3 hover:bg-bg3 transition-colors">
      {/* 커버 이미지 */}
      <div className="flex-shrink-0 w-12 h-16 rounded-lg overflow-hidden bg-bg3">
        {coverImage ? (
          <Image
            src={coverImage}
            alt={title}
            width={48}
            height={64}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-t2 text-xs">
            없음
          </div>
        )}
      </div>

      {/* 텍스트 영역 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-t1 truncate">{title}</p>
        {meta && <p className="text-xs text-t2 mt-0.5 truncate">{meta}</p>}
      </div>

      {/* visibility 뱃지 */}
      <span className={`hidden sm:inline-flex flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${badgeStyle}`}>
        {badgeLabel}
      </span>

      {/* 수정 / 삭제 버튼 */}
      <div className="flex-shrink-0 flex items-center gap-1.5 md:gap-2">
        <Link
          href={editHref}
          aria-label="수정"
          className="flex items-center justify-center gap-1 text-xs text-t2 hover:text-t1 border border-t2/30 hover:border-t2/60 px-2 md:px-3 py-1 rounded-lg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          <span className="hidden md:inline">수정</span>
        </Link>
        <button
          type="button"
          onClick={onDelete}
          aria-label="삭제"
          className="flex items-center justify-center gap-1 text-xs text-t2 hover:text-red border border-t2/30 hover:border-red/40 px-2 md:px-3 py-1 rounded-lg transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
            <path d="M9 6V4h6v2" />
          </svg>
          <span className="hidden md:inline">삭제</span>
        </button>
      </div>
    </div>
  );
}
