"use client";

// 스토리 수정 폼 페이지
// 기존 데이터 로드 후 폼 초기화
// PUT /api/stories/[id] — 성공 시 /my 이동
import { useState, useEffect, FormEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { GENRES } from "@/lib/constants/genres";

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────
const STORY_STATUSES = [
  { value: "ONGOING", label: "연재 중" },
  { value: "COMPLETED", label: "완결" },
  { value: "HIATUS", label: "휴재" },
] as const;

const STORY_VISIBILITIES = [
  { value: "PUBLIC", label: "공개" },
  { value: "PRIVATE", label: "비공개" },
  { value: "UNLISTED", label: "일부 공개 (링크 접근 가능)" },
] as const;

// ─────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────
type StoryDetail = {
  id: string;
  title: string;
  description: string | null;
  genre: string[];
  tags: string[];
  status: string;
  visibility: string;
  coverImage: string | null;
};

type FormState = {
  title: string;
  description: string;
  genre: string[];
  tagsInput: string;
  status: string;
  visibility: string;
  coverImage: string;
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

export default function StoryEditPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const storyId = params.id;

  // 미인증 시 /login 리다이렉트
  if (status === "unauthenticated") {
    router.replace("/login");
    return null;
  }

  const { data: story, error: loadError, isLoading } = useSWR<StoryDetail>(
    storyId ? `/api/stories/${storyId}` : null,
    fetcher
  );

  const [form, setForm] = useState<FormState>({
    title: "",
    description: "",
    genre: [],
    tagsInput: "",
    status: "ONGOING",
    visibility: "PUBLIC",
    coverImage: "",
  });
  const [initialized, setInitialized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 기존 데이터로 폼 초기화 (최초 1회)
  useEffect(() => {
    if (story && !initialized) {
      setForm({
        title: story.title,
        description: story.description ?? "",
        genre: story.genre,
        tagsInput: story.tags.join(", "),
        status: story.status,
        visibility: story.visibility,
        coverImage: story.coverImage ?? "",
      });
      setInitialized(true);
    }
  }, [story, initialized]);

  // 장르 체크박스 토글
  const toggleGenre = (g: string) => {
    setForm((prev) => ({
      ...prev,
      genre: prev.genre.includes(g)
        ? prev.genre.filter((x) => x !== g)
        : [...prev.genre, g],
    }));
  };

  // 폼 제출
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);

    if (form.title.trim().length === 0) {
      setErrorMsg("제목을 입력해주세요.");
      return;
    }
    if (form.genre.length === 0) {
      setErrorMsg("장르를 최소 하나 선택해주세요.");
      return;
    }

    const tags = form.tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    setSubmitting(true);
    try {
      const res = await fetch(`/api/stories/${storyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          genre: form.genre,
          tags,
          status: form.status,
          visibility: form.visibility,
          coverImage: form.coverImage.trim() || null,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "요청 실패" }));
        setErrorMsg(body.error ?? "스토리 수정에 실패했습니다.");
        return;
      }

      router.push("/my");
    } catch {
      setErrorMsg("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-bg2 rounded w-1/3" />
          <div className="h-12 bg-bg2 rounded" />
          <div className="h-32 bg-bg2 rounded" />
        </div>
      </div>
    );
  }

  // 로드 실패
  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 text-center">
        <p className="text-red mb-2">스토리를 불러오지 못했습니다.</p>
        <p className="text-sm text-t2">{loadError.message}</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* 헤더 */}
      <div className="flex items-center gap-3 mb-8">
        <button
          type="button"
          onClick={() => router.back()}
          className="text-t2 hover:text-t1 transition-colors"
          aria-label="뒤로 가기"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-t1">스토리 수정</h1>
      </div>

      {/* 에러 메시지 */}
      {errorMsg && (
        <div className="mb-6 px-4 py-3 bg-red/10 border border-red/30 rounded-lg text-red text-sm">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* 제목 */}
        <div className="flex flex-col gap-2">
          <label htmlFor="title" className="text-sm font-medium text-t1">
            제목 <span className="text-red">*</span>
          </label>
          <input
            id="title"
            type="text"
            value={form.title}
            onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            maxLength={100}
            placeholder="스토리 제목을 입력하세요"
            className="bg-bg2 border border-bg3 focus:border-red/50 rounded-lg px-4 py-2.5 text-sm text-t1 placeholder:text-t2 outline-none transition-colors"
            required
          />
        </div>

        {/* 설명 */}
        <div className="flex flex-col gap-2">
          <label htmlFor="description" className="text-sm font-medium text-t1">
            설명
          </label>
          <textarea
            id="description"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            maxLength={500}
            rows={4}
            placeholder="스토리 소개를 입력하세요 (최대 500자)"
            className="bg-bg2 border border-bg3 focus:border-red/50 rounded-lg px-4 py-2.5 text-sm text-t1 placeholder:text-t2 outline-none resize-none transition-colors"
          />
          <p className="text-xs text-t2 text-right">{form.description.length} / 500</p>
        </div>

        {/* 장르 체크박스 */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-t1">
            장르 <span className="text-red">*</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {GENRES.map((g) => {
              const checked = form.genre.includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() => toggleGenre(g)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                    checked
                      ? "bg-red/20 border-red/50 text-red"
                      : "bg-bg2 border-bg3 text-t2 hover:border-t2/50 hover:text-t1"
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>

        {/* 태그 */}
        <div className="flex flex-col gap-2">
          <label htmlFor="tags" className="text-sm font-medium text-t1">
            태그
          </label>
          <input
            id="tags"
            type="text"
            value={form.tagsInput}
            onChange={(e) => setForm((p) => ({ ...p, tagsInput: e.target.value }))}
            placeholder="태그를 쉼표로 구분하여 입력 (예: 이세계, 회귀)"
            className="bg-bg2 border border-bg3 focus:border-red/50 rounded-lg px-4 py-2.5 text-sm text-t1 placeholder:text-t2 outline-none transition-colors"
          />
          <p className="text-xs text-t2">쉼표(,)로 구분하여 최대 20개 입력 가능</p>
        </div>

        {/* 연재 상태 */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-t1">연재 상태</span>
          <div className="flex flex-wrap gap-3">
            {STORY_STATUSES.map(({ value, label }) => (
              <label key={value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value={value}
                  checked={form.status === value}
                  onChange={() => setForm((p) => ({ ...p, status: value }))}
                  className="accent-red"
                />
                <span className="text-sm text-t1">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 공개 범위 */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-t1">공개 범위</span>
          <div className="flex flex-col gap-2">
            {STORY_VISIBILITIES.map(({ value, label }) => (
              <label key={value} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="visibility"
                  value={value}
                  checked={form.visibility === value}
                  onChange={() => setForm((p) => ({ ...p, visibility: value }))}
                  className="accent-red"
                />
                <span className="text-sm text-t1">{label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* 커버 이미지 URL */}
        <div className="flex flex-col gap-2">
          <label htmlFor="coverImage" className="text-sm font-medium text-t1">
            커버 이미지 URL
          </label>
          <input
            id="coverImage"
            type="url"
            value={form.coverImage}
            onChange={(e) => setForm((p) => ({ ...p, coverImage: e.target.value }))}
            maxLength={500}
            placeholder="https://example.com/cover.jpg"
            className="bg-bg2 border border-bg3 focus:border-red/50 rounded-lg px-4 py-2.5 text-sm text-t1 placeholder:text-t2 outline-none transition-colors"
          />
        </div>

        {/* 제출 버튼 */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-red hover:bg-red/80 disabled:bg-red/40 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            {submitting ? "저장 중..." : "수정 저장"}
          </button>
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-2.5 border border-bg3 hover:border-t2/50 text-t2 hover:text-t1 text-sm rounded-lg transition-colors"
          >
            취소
          </button>
        </div>
      </form>
    </div>
  );
}
