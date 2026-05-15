"use client";

// 캐릭터 목록 페이지
// 상위 3인 트렌드 랭킹 + 요즘 뜨는 캐릭터 섹션 + 새로운 캐릭터 섹션
import useSWR from "swr";
import Image from "next/image";
import Link from "next/link";
import { CharacterCard, CharacterCardProps } from "@/components/ui/CharacterCard";
import SectionRow from "@/components/ui/SectionRow";
import { NumberBadge } from "@/components/ui/NumberBadge";

// ─────────────────────────────────────────────
// 타입
// API 응답은 sessionCount, CharacterCard는 chatCount를 사용하므로 변환 필요
// ─────────────────────────────────────────────
type CharacterApiItem = Omit<CharacterCardProps, "chatCount"> & {
  sessionCount: number;
};

type CharactersResponse = {
  characters: CharacterApiItem[];
};

// API 응답 → CharacterCard props 변환
function toCardProps(item: CharacterApiItem): CharacterCardProps {
  return { ...item, chatCount: item.sessionCount };
}

// ─────────────────────────────────────────────
// fetcher
// ─────────────────────────────────────────────
const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─────────────────────────────────────────────
// 스켈레톤 카드
// ─────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div
      className="flex-shrink-0 w-36 bg-bg2 rounded-xl overflow-hidden animate-pulse"
      style={{ minWidth: "9rem" }}
    >
      <div className="w-full bg-bg3" style={{ aspectRatio: "0.72" }} />
      <div className="p-3 flex flex-col gap-2">
        <div className="h-3 bg-bg3 rounded w-4/5" />
        <div className="h-2.5 bg-bg3 rounded w-1/2" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 트렌드 랭킹 아이템 (가로 레이아웃)
// ─────────────────────────────────────────────
function TrendingRankItem({
  rank,
  character,
}: {
  rank: number;
  character: CharacterApiItem;
}) {
  return (
    <Link
      href={`/characters/${character.id}`}
      className="flex items-center gap-3 p-3 bg-bg2 rounded-xl hover:ring-1 hover:ring-red/40 transition-all"
    >
      {/* 랭킹 번호 */}
      <div className="w-6 text-center flex-shrink-0">
        <NumberBadge rank={rank} />
      </div>

      {/* 아바타 */}
      <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-bg3">
        {character.avatar ? (
          <Image
            src={character.avatar}
            alt={character.name}
            fill
            className="object-cover"
            sizes="40px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm font-bold text-t2/40">
              {character.name[0]?.toUpperCase() ?? "?"}
            </span>
          </div>
        )}
      </div>

      {/* 정보 */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-t1 truncate">{character.name}</p>
        <p className="text-xs text-t2 truncate">{character.creator.nickname}</p>
      </div>

      {/* 대화 수 */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
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
        <span className="text-xs text-t2">
          {character.sessionCount >= 1000
            ? `${(character.sessionCount / 1000).toFixed(1)}k`
            : character.sessionCount}
        </span>
      </div>
    </Link>
  );
}

// ─────────────────────────────────────────────
// 트렌드 랭킹 섹션 (상위 3인)
// ─────────────────────────────────────────────
function TrendingRanking() {
  const { data, error, isLoading } = useSWR<CharactersResponse>(
    "/api/characters?limit=3&sort=popular",
    fetcher
  );

  return (
    <section className="mb-10 px-4 md:px-6">
      <h2 className="text-t1 text-lg md:text-xl font-semibold mb-4">트렌드 랭킹</h2>

      {isLoading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-16 bg-bg2 rounded-xl animate-pulse" />
          ))}
        </div>
      )}

      {(error || (!isLoading && !data)) && (
        <p className="text-t2 text-sm">데이터를 불러올 수 없습니다.</p>
      )}

      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {data.characters.slice(0, 3).map((character, index) => (
            <TrendingRankItem
              key={character.id}
              rank={index + 1}
              character={character}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────
// 캐릭터 카드 리스트 (가로 스크롤용)
// ─────────────────────────────────────────────
function CharacterCardList({ sort }: { sort: "popular" | "latest" }) {
  const { data, error, isLoading } = useSWR<CharactersResponse>(
    `/api/characters?limit=10&sort=${sort}`,
    fetcher
  );

  if (isLoading) {
    return (
      <>
        {Array.from({ length: 6 }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </>
    );
  }

  if (error || !data) {
    return (
      <p className="text-t2 text-sm px-2">데이터를 불러올 수 없습니다.</p>
    );
  }

  if (data.characters.length === 0) {
    return <p className="text-t2 text-sm px-2">캐릭터가 없습니다.</p>;
  }

  return (
    <>
      {data.characters.map((character) => (
        <div
          key={character.id}
          className="flex-shrink-0"
          style={{ minWidth: "9rem", width: "9rem" }}
        >
          <CharacterCard {...toCardProps(character)} />
        </div>
      ))}
    </>
  );
}

// ─────────────────────────────────────────────
// 캐릭터 목록 페이지
// ─────────────────────────────────────────────
export default function CharactersPage() {
  return (
    <div className="min-h-screen pt-4 md:pt-6">
      {/* 트렌드 랭킹 */}
      <TrendingRanking />

      {/* 요즘 뜨는 캐릭터 */}
      <SectionRow title="요즘 뜨는 캐릭터" seeAllHref="/characters?sort=popular">
        <CharacterCardList sort="popular" />
      </SectionRow>

      {/* 새로운 캐릭터 */}
      <SectionRow title="새로운 캐릭터" seeAllHref="/characters?sort=latest">
        <CharacterCardList sort="latest" />
      </SectionRow>
    </div>
  );
}
