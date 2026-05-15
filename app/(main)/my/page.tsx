"use client";

// 내 작품 관리 페이지
// 탭: 내 스토리 / 내 캐릭터
// requireAuth는 클라이언트에서 세션 없으면 /login 리다이렉트로 처리
import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import Link from "next/link";
import { MyItemRow } from "@/components/ui/MyItemRow";

// ─────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────
type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

type StoryItem = {
  id: string;
  title: string;
  coverImage: string | null;
  visibility: string;
  status: string;
  chapterCount: number;
};

type CharacterItem = {
  id: string;
  name: string;
  avatar: string | null;
  visibility: string;
  sessionCount: number;
};

type StoriesResponse = {
  stories: StoryItem[];
  pagination: Pagination;
};

type CharactersResponse = {
  characters: CharacterItem[];
  pagination: Pagination;
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
const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "요청 실패" }));
    throw new Error(err.error ?? "요청 실패");
  }
  return res.json();
};

// ─────────────────────────────────────────────
// 탭 타입
// ─────────────────────────────────────────────
type Tab = "stories" | "characters";

// ─────────────────────────────────────────────
// 스켈레톤 행
// ─────────────────────────────────────────────
function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 bg-bg2 rounded-xl px-4 py-3 animate-pulse">
      <div className="w-12 h-16 rounded-lg bg-bg3 flex-shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="h-3 bg-bg3 rounded w-2/5" />
        <div className="h-2.5 bg-bg3 rounded w-1/4" />
      </div>
      <div className="w-14 h-5 bg-bg3 rounded-full flex-shrink-0" />
      <div className="flex gap-2">
        <div className="w-10 h-6 bg-bg3 rounded-lg" />
        <div className="w-10 h-6 bg-bg3 rounded-lg" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 메인 페이지 컴포넌트
// ─────────────────────────────────────────────
export default function MyPage() {
  const { status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("stories");

  // 미인증 시 /login 리다이렉트
  if (status === "unauthenticated") {
    router.replace("/login");
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-6 md:py-8">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-t1">내 작품</h1>
        {activeTab === "stories" ? (
          <Link
            href="/my/stories/new"
            className="flex items-center gap-1.5 bg-red hover:bg-red/80 text-white text-sm font-medium px-3 md:px-4 py-2 rounded-lg transition-colors"
          >
            <span aria-hidden="true">+</span>
            <span className="hidden sm:inline">새 스토리 만들기</span>
            <span className="sm:hidden">스토리</span>
          </Link>
        ) : (
          <Link
            href="/my/characters/new"
            className="flex items-center gap-1.5 bg-red hover:bg-red/80 text-white text-sm font-medium px-3 md:px-4 py-2 rounded-lg transition-colors"
          >
            <span aria-hidden="true">+</span>
            <span className="hidden sm:inline">새 캐릭터 만들기</span>
            <span className="sm:hidden">캐릭터</span>
          </Link>
        )}
      </div>

      {/* 탭 */}
      <div className="flex border-b border-bg3 mb-6">
        <button
          type="button"
          onClick={() => setActiveTab("stories")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "stories"
              ? "border-red text-t1"
              : "border-transparent text-t2 hover:text-t1"
          }`}
        >
          내 스토리
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("characters")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "characters"
              ? "border-red text-t1"
              : "border-transparent text-t2 hover:text-t1"
          }`}
        >
          내 캐릭터
        </button>
      </div>

      {/* 탭 콘텐츠 */}
      {activeTab === "stories" ? (
        <StoriesTab />
      ) : (
        <CharactersTab />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 내 스토리 탭
// ─────────────────────────────────────────────
function StoriesTab() {
  const { data, error, isLoading, mutate } = useSWR<StoriesResponse>(
    "/api/users/me/stories",
    fetcher
  );

  const handleDelete = useCallback(
    async (id: string, title: string) => {
      if (!confirm(`"${title}" 스토리를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
        return;
      }

      try {
        const res = await fetch(`/api/stories/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "삭제 실패" }));
          alert(body.error ?? "삭제에 실패했습니다.");
          return;
        }
        // 목록 갱신
        await mutate();
      } catch {
        alert("네트워크 오류가 발생했습니다.");
      }
    },
    [mutate]
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 text-t2">
        <p className="text-red mb-2">스토리를 불러오지 못했습니다.</p>
        <p className="text-sm">{error.message}</p>
      </div>
    );
  }

  const stories = data?.stories ?? [];

  if (stories.length === 0) {
    return (
      <div className="text-center py-20 text-t2">
        <p className="text-base mb-3">아직 작성한 스토리가 없습니다.</p>
        <Link
          href="/my/stories/new"
          className="inline-flex items-center gap-1 text-red hover:underline text-sm"
        >
          첫 스토리를 만들어보세요
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {stories.map((story) => {
        const statusLabel = STATUS_LABEL[story.status] ?? story.status;
        const meta = `${statusLabel} · 챕터 ${story.chapterCount}개`;

        return (
          <MyItemRow
            key={story.id}
            id={story.id}
            title={story.title}
            coverImage={story.coverImage}
            visibility={story.visibility}
            meta={meta}
            editHref={`/my/stories/${story.id}/edit`}
            onDelete={() => handleDelete(story.id, story.title)}
          />
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// 내 캐릭터 탭
// ─────────────────────────────────────────────
function CharactersTab() {
  const { data, error, isLoading, mutate } = useSWR<CharactersResponse>(
    "/api/users/me/characters",
    fetcher
  );

  const handleDelete = useCallback(
    async (id: string, name: string) => {
      if (!confirm(`"${name}" 캐릭터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) {
        return;
      }

      try {
        const res = await fetch(`/api/characters/${id}`, { method: "DELETE" });
        if (!res.ok) {
          const body = await res.json().catch(() => ({ error: "삭제 실패" }));
          alert(body.error ?? "삭제에 실패했습니다.");
          return;
        }
        await mutate();
      } catch {
        alert("네트워크 오류가 발생했습니다.");
      }
    },
    [mutate]
  );

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonRow key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-16 text-t2">
        <p className="text-red mb-2">캐릭터를 불러오지 못했습니다.</p>
        <p className="text-sm">{error.message}</p>
      </div>
    );
  }

  const characters = data?.characters ?? [];

  if (characters.length === 0) {
    return (
      <div className="text-center py-20 text-t2">
        <p className="text-base mb-3">아직 만든 캐릭터가 없습니다.</p>
        <Link
          href="/my/characters/new"
          className="inline-flex items-center gap-1 text-red hover:underline text-sm"
        >
          첫 캐릭터를 만들어보세요
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {characters.map((char) => (
        <MyItemRow
          key={char.id}
          id={char.id}
          title={char.name}
          coverImage={char.avatar}
          visibility={char.visibility}
          meta={`채팅 ${char.sessionCount}회`}
          editHref={`/my/characters/${char.id}/edit`}
          onDelete={() => handleDelete(char.id, char.name)}
        />
      ))}
    </div>
  );
}
