import Image from "next/image";
import Link from "next/link";

export type StoryCardProps = {
  id: string;
  title: string;
  author: {
    nickname: string;
  };
  coverImage: string | null;
  genre: string[];
  viewCount: number;
  likeCount: number;
};

/** 숫자 축약 표시 (예: 1200 → "1.2k") */
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function StoryCard({
  id,
  title,
  author,
  coverImage,
  genre,
  viewCount,
  likeCount,
}: StoryCardProps) {
  return (
    <Link
      href={`/stories/${id}`}
      className="group block bg-bg2 rounded-xl overflow-hidden hover:ring-1 hover:ring-red/40 transition-all"
    >
      {/* 커버 이미지 — 세로형 0.72 비율 */}
      <div className="relative w-full" style={{ aspectRatio: "0.72" }}>
        {coverImage ? (
          <Image
            src={coverImage}
            alt={title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        ) : (
          /* 커버 없을 때 플레이스홀더 */
          <div className="absolute inset-0 bg-bg3 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-t2/30"
              aria-hidden="true"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>
        )}

        {/* 장르 뱃지 — 첫 번째 장르만 표시 */}
        {genre[0] && (
          <span className="absolute top-2 left-2 bg-bg/80 text-t2 text-[10px] font-medium px-1.5 py-0.5 rounded backdrop-blur-sm">
            {genre[0]}
          </span>
        )}
      </div>

      {/* 카드 정보 */}
      <div className="p-3 flex flex-col gap-1">
        {/* 제목 — 최대 2줄 */}
        <h3 className="text-sm font-medium text-t1 line-clamp-2 leading-snug">
          {title}
        </h3>

        {/* 작가명 */}
        <p className="text-xs text-t2 truncate">{author.nickname}</p>

        {/* 통계 */}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="flex items-center gap-0.5 text-xs text-t2">
            <span aria-hidden="true">♥</span>
            <span>{formatCount(likeCount)}</span>
          </span>
          <span className="flex items-center gap-0.5 text-xs text-t2">
            <span aria-hidden="true">👁</span>
            <span>{formatCount(viewCount)}</span>
          </span>
        </div>
      </div>
    </Link>
  );
}
