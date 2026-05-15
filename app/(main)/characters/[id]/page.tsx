"use client";

// 캐릭터 상세 페이지
// 아바타 + 이름 + 태그 + 소개 + "대화 시작하기" 버튼
import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import useSWR from "swr";

// ─────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────
type CharacterDetail = {
  id: string;
  name: string;
  description: string | null;
  personality: string | null;
  avatar: string | null;
  tags: string[];
  sessionCount: number;
  creator: {
    id: string;
    nickname: string;
  };
};

type CreateSessionResponse = {
  id: string;
  characterId: string;
  title: string | null;
};

// ─────────────────────────────────────────────
// fetcher
// ─────────────────────────────────────────────
const fetcher = (url: string) => fetch(url).then((r) => r.json());

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
function CharacterDetailSkeleton() {
  return (
    <div className="animate-pulse px-6 pt-8">
      <div className="flex flex-col items-center gap-4">
        <div className="w-28 h-28 bg-bg2 rounded-2xl" />
        <div className="h-6 bg-bg2 rounded w-32" />
        <div className="h-4 bg-bg2 rounded w-24" />
      </div>
      <div className="mt-8 flex flex-col gap-3">
        <div className="h-4 bg-bg2 rounded" />
        <div className="h-4 bg-bg2 rounded w-5/6" />
        <div className="h-4 bg-bg2 rounded w-4/5" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 캐릭터 상세 페이지
// ─────────────────────────────────────────────
export default function CharacterDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { id } = params;

  const { data: character, error, isLoading } = useSWR<CharacterDetail>(
    `/api/characters/${id}`,
    fetcher
  );

  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  // 대화 세션 생성 후 /chat/[sessionId]로 이동
  async function handleStartChat() {
    if (starting) return;
    setStarting(true);
    setStartError(null);

    try {
      const res = await fetch("/api/chat/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: id }),
      });

      if (res.status === 401) {
        // 로그인 필요 — 로그인 페이지로 이동
        router.push("/login");
        return;
      }

      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setStartError(body.error ?? "세션을 만들 수 없습니다.");
        return;
      }

      const session = (await res.json()) as CreateSessionResponse;
      router.push(`/chat/${session.id}`);
    } catch {
      setStartError("네트워크 오류가 발생했습니다.");
    } finally {
      setStarting(false);
    }
  }

  if (isLoading) {
    return <CharacterDetailSkeleton />;
  }

  if (error || !character) {
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

  return (
    <div className="min-h-screen px-6 pt-8 pb-16 max-w-2xl mx-auto">
      {/* 아바타 + 이름 + 크리에이터 + 대화 수 */}
      <div className="flex flex-col items-center text-center mb-8">
        {/* 아바타 */}
        <div className="relative w-28 h-28 rounded-2xl overflow-hidden bg-bg3 mb-4">
          {character.avatar ? (
            <Image
              src={character.avatar}
              alt={character.name}
              fill
              className="object-cover"
              priority
              sizes="112px"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-4xl font-bold text-t2/30 select-none">
                {character.name[0]?.toUpperCase() ?? "?"}
              </span>
            </div>
          )}
        </div>

        {/* 캐릭터 이름 */}
        <h1 className="text-t1 text-2xl font-bold mb-1">{character.name}</h1>

        {/* 크리에이터 + 대화 수 */}
        <div className="flex items-center gap-3 text-sm text-t2">
          <span>by {character.creator.nickname}</span>
          <span aria-hidden="true">·</span>
          <span className="flex items-center gap-1">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            {formatCount(character.sessionCount)} 대화
          </span>
        </div>
      </div>

      {/* 구분선 */}
      <div className="border-t border-bg3 mb-6" />

      {/* 태그 */}
      {character.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {character.tags.map((tag) => (
            <span
              key={tag}
              className="bg-bg3 text-t2 text-xs px-2 py-1 rounded-full"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* 소개 텍스트 */}
      {character.description && (
        <p className="text-t2 text-sm leading-relaxed whitespace-pre-line mb-6">
          {character.description}
        </p>
      )}

      {/* 성격 정보 */}
      {character.personality && (
        <div className="bg-bg2 rounded-xl p-4 mb-6">
          <p className="text-xs text-t2 mb-1.5 font-medium">성격</p>
          <p className="text-sm text-t1 leading-relaxed">
            {character.personality}
          </p>
        </div>
      )}

      {/* 대화 시작하기 버튼 */}
      <div className="flex flex-col gap-2">
        <button
          onClick={handleStartChat}
          disabled={starting}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-red text-white text-base font-semibold rounded-xl hover:bg-red/90 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          {starting ? "세션 생성 중..." : "대화 시작하기"}
        </button>

        {/* 에러 메시지 */}
        {startError && (
          <p className="text-red text-sm text-center">{startError}</p>
        )}
      </div>
    </div>
  );
}
