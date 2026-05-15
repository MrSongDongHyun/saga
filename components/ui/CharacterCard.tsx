import Image from "next/image";
import Link from "next/link";

export type CharacterCardProps = {
  id: string;
  name: string;
  description: string | null;
  avatar: string | null;
  tags: string[];
  chatCount: number;
  creator: {
    nickname: string;
  };
};

/** 숫자 축약 표시 (예: 1200 → "1.2k") */
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function CharacterCard({
  id,
  name,
  description,
  avatar,
  tags,
  chatCount,
  creator,
}: CharacterCardProps) {
  return (
    <Link
      href={`/characters/${id}`}
      className="group block bg-bg2 rounded-xl overflow-hidden hover:ring-1 hover:ring-red/40 transition-all"
    >
      {/* 아바타 이미지 — 세로형 portrait 비율 */}
      <div className="relative w-full" style={{ aspectRatio: "0.72" }}>
        {avatar ? (
          <Image
            src={avatar}
            alt={name}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
        ) : (
          /* 아바타 없을 때 이니셜 플레이스홀더 */
          <div className="absolute inset-0 bg-bg3 flex items-center justify-center">
            <span className="text-4xl font-bold text-t2/30 select-none">
              {name[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
        )}

        {/* 대화 수 뱃지 — 우측 하단 */}
        <div className="absolute bottom-2 right-2 bg-bg/80 backdrop-blur-sm rounded px-1.5 py-0.5 flex items-center gap-0.5">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-t2"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="text-[10px] text-t2 font-medium">
            {formatCount(chatCount)}
          </span>
        </div>
      </div>

      {/* 카드 정보 */}
      <div className="p-3 flex flex-col gap-1.5">
        {/* 캐릭터 이름 */}
        <h3 className="text-sm font-semibold text-t1 truncate">{name}</h3>

        {/* 제작자 */}
        <p className="text-xs text-t2 truncate">{creator.nickname}</p>

        {/* 설명 — 최대 2줄 */}
        {description && (
          <p className="text-xs text-t2 line-clamp-2 leading-relaxed">
            {description}
          </p>
        )}

        {/* 태그 목록 — 처음 2개만 */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-0.5">
            {tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="text-[10px] text-t2 bg-bg3 px-1.5 py-0.5 rounded"
              >
                #{tag}
              </span>
            ))}
            {tags.length > 2 && (
              <span className="text-[10px] text-t2/50">+{tags.length - 2}</span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
