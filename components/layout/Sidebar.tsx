"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSession } from "next-auth/react";
import useSWR from "swr";

// ─────────────────────────────────────────────
// 응답 타입
// ─────────────────────────────────────────────

type ChatSessionItem = {
  id: string;
  characterId: string;
  title: string | null;
  character: {
    id: string;
    name: string;
    avatar: string | null;
  };
  lastMessage: {
    content: string;
    createdAt: string;
  } | null;
  updatedAt: string;
};

type PlaySessionItem = {
  id: string;
  storyId: string;
  chapterId: string;
  branchId: string | null;
  turnCount: number;
  lastMessage: string | null;
  updatedAt: string;
  story: {
    id: string;
    title: string;
    coverImage: string | null;
  };
};

type BookmarkItem = {
  id: string;
  storyId: string;
  createdAt: string;
  story: {
    id: string;
    title: string;
    coverImage: string | null;
    author: { nickname: string };
  };
};

// chat 세션과 play 세션을 updatedAt 기준으로 합산하기 위한 통합 타입
type RecentItem =
  | { type: "chat"; data: ChatSessionItem; updatedAt: string }
  | { type: "play"; data: PlaySessionItem; updatedAt: string };

type SidebarTab = "recent" | "bookmark";

// ─────────────────────────────────────────────
// SWR fetcher
// ─────────────────────────────────────────────
async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("fetch error");
  return res.json() as Promise<T>;
}

/** 경과 시간 표시 (예: "2시간 전") */
function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

// ─────────────────────────────────────────────
// 서브 컴포넌트
// ─────────────────────────────────────────────

function AvatarPlaceholder({ name }: { name: string }) {
  return (
    <div className="w-10 h-10 rounded-full bg-bg3 text-t2 flex items-center justify-center text-sm font-bold shrink-0 select-none">
      {name[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

/** 플레이 세션 아이콘 (book SVG) */
function BookIcon() {
  return (
    <div className="w-10 h-10 rounded-lg bg-bg3 flex items-center justify-center shrink-0">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-t2"
        aria-hidden="true"
      >
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
      </svg>
    </div>
  );
}

/** 채팅 세션 + 플레이 세션을 updatedAt 기준 내림차순으로 합산하여 표시 */
function RecentCombinedList({
  items,
  onItemClick,
}: {
  items: RecentItem[];
  onItemClick?: () => void;
}) {
  if (items.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-t2 text-center">
        최근 대화 기록이 없어요.
      </p>
    );
  }

  return (
    <ul>
      {items.map((item) => {
        if (item.type === "chat") {
          const session = item.data;
          return (
            <li key={`chat-${session.id}`}>
              <Link
                href={`/chat/${session.id}`}
                onClick={onItemClick}
                className="flex items-start gap-3 px-4 py-3 hover:bg-bg3 transition-colors"
              >
                {/* 캐릭터 아바타 */}
                {session.character.avatar ? (
                  <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 relative">
                    <Image
                      src={session.character.avatar}
                      alt={session.character.name}
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  </div>
                ) : (
                  <AvatarPlaceholder name={session.character.name} />
                )}

                {/* 텍스트 영역 */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-t1 truncate font-medium">
                    {session.title ?? session.character.name}
                  </p>
                  {session.lastMessage && (
                    <p className="text-xs text-t2 truncate mt-0.5">
                      {session.lastMessage.content}
                    </p>
                  )}
                  <p className="text-xs text-t2/60 mt-0.5">
                    {timeAgo(session.updatedAt)}
                  </p>
                </div>
              </Link>
            </li>
          );
        }

        // play 세션
        const ps = item.data;
        const href = `/story/${ps.storyId}/play?chapter=${ps.chapterId}&session=${ps.id}`;
        return (
          <li key={`play-${ps.id}`}>
            <Link
              href={href}
              onClick={onItemClick}
              className="flex items-start gap-3 px-4 py-3 hover:bg-bg3 transition-colors"
            >
              <BookIcon />

              {/* 텍스트 영역 */}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-t1 truncate font-medium">
                  {ps.story.title}
                </p>
                <p className="text-xs text-t2 truncate mt-0.5">
                  {ps.turnCount}턴 진행 중
                </p>
                <p className="text-xs text-t2/60 mt-0.5">
                  {timeAgo(ps.updatedAt)}
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function BookmarkList({
  bookmarks,
  onItemClick,
}: {
  bookmarks: BookmarkItem[];
  onItemClick?: () => void;
}) {
  if (bookmarks.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-t2 text-center">
        북마크한 스토리가 없어요.
      </p>
    );
  }

  return (
    <ul>
      {bookmarks.map((bm) => (
        <li key={bm.id}>
          <Link
            href={`/stories/${bm.story.id}`}
            onClick={onItemClick}
            className="flex items-start gap-3 px-4 py-3 hover:bg-bg3 transition-colors"
          >
            {/* 커버 썸네일 */}
            {bm.story.coverImage ? (
              <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 relative">
                <Image
                  src={bm.story.coverImage}
                  alt={bm.story.title}
                  fill
                  className="object-cover"
                  sizes="40px"
                />
              </div>
            ) : (
              <div className="w-10 h-10 rounded-lg bg-bg3 shrink-0" />
            )}

            {/* 텍스트 영역 */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-t1 truncate font-medium">
                {bm.story.title}
              </p>
              <p className="text-xs text-t2 truncate mt-0.5">
                {bm.story.author.nickname}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

// ─────────────────────────────────────────────
// 사이드바 props
// ─────────────────────────────────────────────

type SidebarProps = {
  mobileOpen: boolean;
  onClose: () => void;
};

// ─────────────────────────────────────────────
// 사이드바 내부 콘텐츠 (PC/모바일 공용)
// ─────────────────────────────────────────────

function SidebarContent({ onItemClick }: { onItemClick?: () => void }) {
  const { status } = useSession();
  const [activeTab, setActiveTab] = useState<SidebarTab>("recent");

  const isAuthenticated = status === "authenticated";

  const { data: sessionsData } = useSWR<{ sessions: ChatSessionItem[] }>(
    isAuthenticated ? "/api/chat/sessions?limit=10" : null,
    fetcher
  );

  const { data: playSessionsData } = useSWR<{ sessions: PlaySessionItem[] }>(
    isAuthenticated ? "/api/play-sessions?limit=10" : null,
    fetcher
  );

  const { data: bookmarksData } = useSWR<{ bookmarks: BookmarkItem[] }>(
    isAuthenticated && activeTab === "bookmark"
      ? "/api/users/me/bookmarks?limit=10"
      : null,
    fetcher
  );

  // chat + play 세션을 updatedAt 내림차순으로 합산 (최대 15개)
  const recentItems: RecentItem[] = [
    ...(sessionsData?.sessions ?? []).map(
      (s): RecentItem => ({ type: "chat", data: s, updatedAt: s.updatedAt })
    ),
    ...(playSessionsData?.sessions ?? []).map(
      (s): RecentItem => ({ type: "play", data: s, updatedAt: s.updatedAt })
    ),
  ]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 15);

  return (
    <>
      {/* 탭 헤더 */}
      <div className="flex border-b border-bg3 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab("recent")}
          className={[
            "flex-1 py-3 text-sm font-medium transition-colors",
            activeTab === "recent"
              ? "text-t1 border-b-2 border-red"
              : "text-t2 hover:text-t1",
          ].join(" ")}
        >
          최근 대화
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("bookmark")}
          className={[
            "flex-1 py-3 text-sm font-medium transition-colors",
            activeTab === "bookmark"
              ? "text-t1 border-b-2 border-red"
              : "text-t2 hover:text-t1",
          ].join(" ")}
        >
          북마크
        </button>
      </div>

      {/* 콘텐츠 */}
      <div className="flex-1 overflow-y-auto">
        {/* 미인증 상태 */}
        {!isAuthenticated && status !== "loading" && (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-t2 leading-relaxed">
              로그인하면 대화 기록이 보여요.
            </p>
          </div>
        )}

        {/* 로딩 상태 */}
        {status === "loading" && (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-bg3 animate-pulse shrink-0" />
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="h-3 bg-bg3 rounded animate-pulse" />
                  <div className="h-3 bg-bg3 rounded animate-pulse w-2/3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 최근 대화 탭 */}
        {isAuthenticated && activeTab === "recent" && (
          <RecentCombinedList items={recentItems} onItemClick={onItemClick} />
        )}

        {/* 북마크 탭 */}
        {isAuthenticated && activeTab === "bookmark" && (
          <BookmarkList
            bookmarks={bookmarksData?.bookmarks ?? []}
            onItemClick={onItemClick}
          />
        )}
      </div>
    </>
  );
}

// ─────────────────────────────────────────────
// 메인 컴포넌트
// ─────────────────────────────────────────────

export function Sidebar({ mobileOpen, onClose }: SidebarProps) {
  return (
    <>
      {/* ── 모바일 오버레이 (z-40) ── */}
      {/* 사이드바가 열렸을 때만 렌더링 — 클릭 시 닫기 */}
      <div
        className={[
          "fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity duration-300",
          mobileOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        ].join(" ")}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* ── 모바일 드로어 (z-50) ── */}
      <aside
        className={[
          // 모바일: fixed 드로어, 헤더(h-14) 아래에서 시작
          "fixed left-0 top-14 bottom-0 w-72 z-50",
          "bg-bg2 border-r border-bg3 flex flex-col overflow-hidden",
          "transition-transform duration-300",
          // 모바일에서 open 여부에 따라 슬라이드
          mobileOpen ? "translate-x-0" : "-translate-x-full",
          // PC: 항상 표시 (relative로 플로우에 참여, transform 초기화)
          "md:relative md:top-auto md:bottom-auto md:left-auto md:z-auto",
          "md:translate-x-0 md:flex md:w-60 md:shrink-0",
        ].join(" ")}
        aria-label="사이드바"
      >
        <SidebarContent onItemClick={onClose} />
      </aside>
    </>
  );
}
