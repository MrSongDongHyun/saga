"use client";

// 스토리 상세 페이지
// 커버 이미지 + 메타 정보 + 좋아요/북마크 토글 + 챕터 목록 + 이어하기
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";

// ─────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────
type ChapterSummary = {
  id: string;
  title: string;
  orderIndex: number;
  isPublished: boolean;
  createdAt: string;
};

type StoryDetail = {
  id: string;
  title: string;
  description: string | null;
  genre: string[];
  tags: string[];
  status: string;
  coverImage: string | null;
  viewCount: number;
  likeCount: number;
  bookmarkCount: number;
  chapterCount: number;
  author: { id: string; nickname: string };
  chapters: ChapterSummary[];
  isLiked?: boolean;
  isBookmarked?: boolean;
};

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────
const STATUS_LABEL: Record<string, string> = {
  ONGOING: "연재 중",
  COMPLETED: "완결",
  HIATUS: "휴재",
};

// ─────────────────────────────────────────────
// fetcher
// ─────────────────────────────────────────────
const fetcher = (url: string) => fetch(url).then((r) => r.json());

// ─────────────────────────────────────────────
// 날짜 포맷 (YYYY.MM.DD)
// ─────────────────────────────────────────────
function formatDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}.${m}.${day}`;
}

// ─────────────────────────────────────────────
// 숫자 포맷
// ─────────────────────────────────────────────
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}m`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

// ─────────────────────────────────────────────
// 스켈레톤 UI
// ─────────────────────────────────────────────
function StoryDetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="w-full bg-bg2" style={{ height: "280px" }} />
      <div className="p-6 flex flex-col gap-4">
        <div className="h-6 bg-bg2 rounded w-2/3" />
        <div className="h-4 bg-bg2 rounded w-1/3" />
        <div className="h-20 bg-bg2 rounded" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 좋아요 버튼
// ─────────────────────────────────────────────
function LikeButton({
  storyId,
  initialLiked,
  initialCount,
}: {
  storyId: string;
  initialLiked: boolean;
  initialCount: number;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/stories/${storyId}/like`, {
        method: "POST",
      });
      if (res.ok) {
        const data = (await res.json()) as { liked: boolean; likeCount: number };
        setLiked(data.liked);
        setCount(data.likeCount);
      }
    } catch {
      // 조용히 실패 처리 (토스트 없이)
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={[
        "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
        liked
          ? "bg-red/20 text-red border border-red/40"
          : "bg-bg3 text-t2 border border-bg3 hover:border-t2/40",
      ].join(" ")}
      aria-label={liked ? "좋아요 취소" : "좋아요"}
    >
      <span aria-hidden="true">{liked ? "♥" : "♡"}</span>
      <span>{formatCount(count)}</span>
    </button>
  );
}

// ─────────────────────────────────────────────
// 북마크 버튼
// ─────────────────────────────────────────────
function BookmarkButton({
  storyId,
  initialBookmarked,
  initialCount,
}: {
  storyId: string;
  initialBookmarked: boolean;
  initialCount: number;
}) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/stories/${storyId}/bookmark`, {
        method: "POST",
      });
      if (res.ok) {
        const data = (await res.json()) as {
          bookmarked: boolean;
          bookmarkCount: number;
        };
        setBookmarked(data.bookmarked);
        setCount(data.bookmarkCount);
      }
    } catch {
      // 조용히 실패 처리
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={[
        "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors",
        bookmarked
          ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/40"
          : "bg-bg3 text-t2 border border-bg3 hover:border-t2/40",
      ].join(" ")}
      aria-label={bookmarked ? "북마크 취소" : "북마크"}
    >
      <span aria-hidden="true">{bookmarked ? "🔖" : "🔖"}</span>
      <span>{formatCount(count)}</span>
    </button>
  );
}

// ─────────────────────────────────────────────
// 스토리 상세 페이지
// ─────────────────────────────────────────────
type PlayProgress = {
  lastChapterId: string;
  completedChapterIds: string[];
};

export default function StoryDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { id } = params;

  // 이어하기: localStorage에서 진행 상황 복원
  const [resumeChapterId, setResumeChapterId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`saga-play-progress-${id}`);
      if (saved) {
        const progress = JSON.parse(saved) as PlayProgress;
        if (progress.lastChapterId) {
          setResumeChapterId(progress.lastChapterId);
        }
      }
    } catch {
      /* ignore */
    }
  }, [id]);

  const { data: story, error, isLoading } = useSWR<StoryDetail>(
    `/api/stories/${id}`,
    fetcher
  );

  if (isLoading) {
    return <StoryDetailSkeleton />;
  }

  if (error || !story) {
    return (
      <div className="flex flex-col items-center justify-center min-h-64 gap-4">
        <p className="text-t2">데이터를 불러올 수 없습니다.</p>
        <button
          onClick={() => router.back()}
          className="text-sm text-t2 hover:text-t1 transition-colors"
        >
          뒤로 가기
        </button>
      </div>
    );
  }

  // 이어하기 챕터 정보
  const resumeChapter = resumeChapterId
    ? story.chapters.find((ch) => ch.id === resumeChapterId)
    : null;

  // 첫 번째 챕터 ID (플레이 시작용)
  const firstPublishedChapter = story.chapters.find((ch) => ch.isPublished);

  return (
    <div className="min-h-screen">
      {/* 커버 이미지 (전체 너비, 280px 높이) */}
      <div className="relative w-full" style={{ height: "280px" }}>
        {story.coverImage ? (
          <Image
            src={story.coverImage}
            alt={story.title}
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
        ) : (
          <div className="absolute inset-0 bg-bg3 flex items-center justify-center">
            <span className="text-4xl font-bold text-t2/20 select-none tracking-widest">
              SAGA
            </span>
          </div>
        )}

        {/* 그라디언트 오버레이 */}
        <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" />

        {/* 장르 뱃지 + 액션 버튼 — 커버 하단 오버레이 */}
        <div className="absolute bottom-0 left-0 right-0 px-6 pb-4 flex items-end justify-between gap-3">
          {/* 장르 뱃지 */}
          <div className="flex flex-wrap gap-1.5">
            {story.genre.map((g) => (
              <span
                key={g}
                className="bg-bg3/80 text-t2 text-xs px-2 py-1 rounded-full backdrop-blur-sm"
              >
                {g}
              </span>
            ))}
          </div>

          {/* 좋아요/북마크 */}
          <div className="flex items-center gap-2">
            <LikeButton
              storyId={id}
              initialLiked={story.isLiked ?? false}
              initialCount={story.likeCount}
            />
            <BookmarkButton
              storyId={id}
              initialBookmarked={story.isBookmarked ?? false}
              initialCount={story.bookmarkCount}
            />
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="px-6 pt-5 pb-10">
        {/* 제목 + 작가 */}
        <h1 className="text-t1 text-2xl font-bold leading-tight mb-1">
          {story.title}
        </h1>
        <p className="text-t2 text-sm mb-6">
          by{" "}
          <span className="text-t1 font-medium">{story.author.nickname}</span>
        </p>

        {/* 메타 + 설명 그리드 */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_200px] gap-6 mb-8">
          {/* 왼쪽: 설명 + 태그 + 플레이 버튼 */}
          <div className="flex flex-col gap-4">
            {story.description && (
              <p className="text-t2 text-sm leading-relaxed whitespace-pre-line">
                {story.description}
              </p>
            )}

            {/* 태그 */}
            {story.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {story.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-bg3 text-t2 text-xs px-2 py-1 rounded-full"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            {/* 플레이 버튼 영역 */}
            {firstPublishedChapter ? (
              <div className="flex flex-col gap-2">
                {/* 이어하기 (진행 기록이 있을 때) */}
                {resumeChapter && resumeChapter.id !== firstPublishedChapter.id && (
                  <Link
                    href={`/story/${id}/play?chapter=${resumeChapter.id}`}
                    className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3 bg-red text-white text-sm font-semibold rounded-xl hover:bg-red/90 transition-colors"
                  >
                    <span aria-hidden="true">▶</span>
                    이어하기{" "}
                    <span className="font-normal opacity-80">
                      ({resumeChapter.orderIndex + 1}화부터)
                    </span>
                  </Link>
                )}
                {/* 처음부터 / 첫 플레이 */}
                <Link
                  href={`/story/${id}/play?chapter=${firstPublishedChapter.id}`}
                  className={[
                    "inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3 text-sm font-semibold rounded-xl transition-colors",
                    resumeChapter && resumeChapter.id !== firstPublishedChapter.id
                      ? "bg-bg3 text-t2 hover:bg-bg2 hover:text-t1"
                      : "bg-red text-white hover:bg-red/90",
                  ].join(" ")}
                >
                  <span aria-hidden="true">▶</span>
                  {resumeChapter ? "처음부터" : "플레이 시작"}
                </Link>
              </div>
            ) : (
              <button
                disabled
                className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-8 py-3 bg-bg3 text-t2 text-sm font-semibold rounded-xl cursor-not-allowed"
              >
                <span aria-hidden="true">▶</span>
                챕터 준비 중
              </button>
            )}
          </div>

          {/* 오른쪽: 상태/통계 */}
          <div className="flex flex-col gap-3 bg-bg2 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-t2 text-xs">상태</span>
              <span
                className={[
                  "text-xs font-medium px-2 py-0.5 rounded-full",
                  story.status === "COMPLETED"
                    ? "bg-green-500/20 text-green-400"
                    : story.status === "ONGOING"
                    ? "bg-blue-500/20 text-blue-400"
                    : "bg-yellow-500/20 text-yellow-400",
                ].join(" ")}
              >
                {STATUS_LABEL[story.status] ?? story.status}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-t2 text-xs">챕터</span>
              <span className="text-t1 text-sm font-medium">
                {story.chapterCount}화
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-t2 text-xs">조회</span>
              <span className="text-t1 text-sm font-medium">
                {formatCount(story.viewCount)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-t2 text-xs">좋아요</span>
              <span className="text-t1 text-sm font-medium">
                {formatCount(story.likeCount)}
              </span>
            </div>
          </div>
        </div>

        {/* 챕터 목록 */}
        {story.chapters.length > 0 && (
          <section>
            <h2 className="text-t1 text-lg font-semibold mb-3">챕터 목록</h2>
            <div className="flex flex-col gap-1">
              {story.chapters
                .filter((ch) => ch.isPublished)
                .map((ch) => (
                  <Link
                    key={ch.id}
                    href={`/story/${id}/play?chapter=${ch.id}`}
                    className="flex items-center justify-between px-4 py-3 bg-bg2 rounded-lg hover:bg-bg3 transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-xs text-t2 flex-shrink-0 tabular-nums">
                        {String(ch.orderIndex + 1).padStart(2, "0")}화
                      </span>
                      <span className="text-sm text-t1 truncate group-hover:text-t1">
                        {ch.title}
                      </span>
                    </div>
                    <span className="text-xs text-t2 flex-shrink-0 ml-4">
                      {formatDate(ch.createdAt)}
                    </span>
                  </Link>
                ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
