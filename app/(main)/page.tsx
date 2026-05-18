"use client";

// 홈 피드 — 스토리 탭
// 장르 필터 + 인기 섹션 + 최신 섹션
import { useState } from "react";
import useSWR from "swr";
import { StoryCard, StoryCardProps } from "@/components/ui/StoryCard";
import SectionRow from "@/components/ui/SectionRow";

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────
const GENRES = [
  { label: "전체", value: "" },
  { label: "로맨스", value: "로맨스" },
  { label: "판타지", value: "판타지" },
  { label: "현대", value: "현대" },
  { label: "무협", value: "무협" },
  { label: "SF", value: "SF" },
];

// ─────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────
type StoriesResponse = {
  stories: StoryCardProps[];
};

// ─────────────────────────────────────────────
// fetcher
// ─────────────────────────────────────────────
const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─────────────────────────────────────────────
// 스켈레톤 카드 (로딩 상태)
// ─────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div
      className="bg-bg2 rounded-xl overflow-hidden animate-pulse"
      style={{ width: "164px", height: "335px", flexShrink: 0 }}
    >
      <div className="w-full bg-bg3" style={{ height: "247px" }} />
      <div className="p-3 flex flex-col gap-2">
        <div className="h-3 bg-bg3 rounded w-4/5" />
        <div className="h-2.5 bg-bg3 rounded w-1/2" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 스토리 카드 리스트
// ─────────────────────────────────────────────
function StoryCardList({
  genre,
  sort,
  variant = "scroll",
}: {
  genre: string;
  sort: "popular" | "latest";
  variant?: "scroll" | "grid";
}) {
  const params = new URLSearchParams({
    sort,
    ...(genre ? { genre } : {}),
  });

  const { data, error, isLoading } = useSWR<StoriesResponse>(
    `/api/stories?${params.toString()}`,
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

  if (data.stories.length === 0) {
    return <p className="text-t2 text-sm px-2">스토리가 없습니다.</p>;
  }

  return (
    <>
      {data.stories.map((story) => (
        <div key={story.id} style={{ width: "164px", flexShrink: 0 }}>
          <StoryCard {...story} />
        </div>
      ))}
    </>
  );
}

// ─────────────────────────────────────────────
// 홈 피드 페이지
// ─────────────────────────────────────────────
export default function HomePage() {
  const [activeGenre, setActiveGenre] = useState<string>("");

  return (
    <div className="min-h-screen px-0">
      {/* 장르 필터바 — sticky (헤더 높이 56px 아래) */}
      <div className="sticky top-14 z-10 bg-bg border-b border-bg3">
        <div className="flex items-center gap-2 px-4 md:px-6 py-3 overflow-x-auto scrollbar-hide">
          {GENRES.map(({ label, value }) => (
            <button
              key={value}
              onClick={() => setActiveGenre(value)}
              className={[
                "flex-shrink-0 text-xs px-3 py-1.5 rounded-full transition-colors",
                activeGenre === value
                  ? "bg-red text-white font-medium"
                  : "bg-bg3 text-t2 hover:text-t1",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 콘텐츠 */}
      <div className="pt-6">
        {/* 섹션: 지금 인기 — 최대 6열 wrap 그리드 */}
        <SectionRow
          title="지금 인기"
          variant="grid"
          seeAllHref={`/stories?sort=popular${activeGenre ? `&genre=${activeGenre}` : ""}`}
        >
          <StoryCardList genre={activeGenre} sort="popular" variant="grid" />
        </SectionRow>

        {/* 섹션: 새로 올라왔어요 — 숨김 */}
        {/* <SectionRow
          title="새로 올라왔어요"
          seeAllHref={`/stories?sort=latest${activeGenre ? `&genre=${activeGenre}` : ""}`}
        >
          <StoryCardList genre={activeGenre} sort="latest" />
        </SectionRow> */}
      </div>
    </div>
  );
}
