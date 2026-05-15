"use client";

// 캐릭터 생성 폼 페이지
// POST /api/characters — 성공 시 /my 이동
import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────
const CHAR_VISIBILITIES = [
  { value: "PUBLIC", label: "공개" },
  { value: "PRIVATE", label: "비공개" },
  { value: "UNLISTED", label: "일부 공개 (링크 접근 가능)" },
] as const;

// ─────────────────────────────────────────────
// 폼 상태 타입
// ─────────────────────────────────────────────
type FormState = {
  name: string;
  description: string;
  personality: string;
  backgroundStory: string;
  firstMessage: string;
  avatar: string;
  tagsInput: string;
  visibility: string;
};

export default function CharacterNewPage() {
  const { status } = useSession();
  const router = useRouter();

  // 미인증 시 /login 리다이렉트
  if (status === "unauthenticated") {
    router.replace("/login");
    return null;
  }

  const [form, setForm] = useState<FormState>({
    name: "",
    description: "",
    personality: "",
    backgroundStory: "",
    firstMessage: "",
    avatar: "",
    tagsInput: "",
    visibility: "PUBLIC",
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 폼 제출
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);

    if (form.name.trim().length === 0) {
      setErrorMsg("캐릭터 이름을 입력해주세요.");
      return;
    }

    const tags = form.tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    setSubmitting(true);
    try {
      const res = await fetch("/api/characters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || undefined,
          personality: form.personality.trim() || undefined,
          backgroundStory: form.backgroundStory.trim() || undefined,
          firstMessage: form.firstMessage.trim() || undefined,
          avatar: form.avatar.trim() || undefined,
          tags,
          visibility: form.visibility,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "요청 실패" }));
        setErrorMsg(body.error ?? "캐릭터 생성에 실패했습니다.");
        return;
      }

      router.push("/my");
    } catch {
      setErrorMsg("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

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
        <h1 className="text-xl font-bold text-t1">새 캐릭터 만들기</h1>
      </div>

      {/* 에러 메시지 */}
      {errorMsg && (
        <div className="mb-6 px-4 py-3 bg-red/10 border border-red/30 rounded-lg text-red text-sm">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        {/* 이름 */}
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-sm font-medium text-t1">
            캐릭터 이름 <span className="text-red">*</span>
          </label>
          <input
            id="name"
            type="text"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            maxLength={50}
            placeholder="캐릭터 이름을 입력하세요"
            className="bg-bg2 border border-bg3 focus:border-red/50 rounded-lg px-4 py-2.5 text-sm text-t1 placeholder:text-t2 outline-none transition-colors"
            required
          />
        </div>

        {/* 캐릭터 소개 */}
        <div className="flex flex-col gap-2">
          <label htmlFor="description" className="text-sm font-medium text-t1">
            캐릭터 소개
          </label>
          <textarea
            id="description"
            value={form.description}
            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            maxLength={1000}
            rows={3}
            placeholder="캐릭터를 간략히 소개해주세요 (최대 1000자)"
            className="bg-bg2 border border-bg3 focus:border-red/50 rounded-lg px-4 py-2.5 text-sm text-t1 placeholder:text-t2 outline-none resize-none transition-colors"
          />
          <p className="text-xs text-t2 text-right">{form.description.length} / 1000</p>
        </div>

        {/* 성격 */}
        <div className="flex flex-col gap-2">
          <label htmlFor="personality" className="text-sm font-medium text-t1">
            성격
          </label>
          <textarea
            id="personality"
            value={form.personality}
            onChange={(e) => setForm((p) => ({ ...p, personality: e.target.value }))}
            maxLength={2000}
            rows={4}
            placeholder="캐릭터의 성격, 말투, 행동 방식을 자세히 설명해주세요 (AI 프롬프트에 사용됩니다)"
            className="bg-bg2 border border-bg3 focus:border-red/50 rounded-lg px-4 py-2.5 text-sm text-t1 placeholder:text-t2 outline-none resize-none transition-colors"
          />
          <p className="text-xs text-t2 text-right">{form.personality.length} / 2000</p>
        </div>

        {/* 배경 스토리 */}
        <div className="flex flex-col gap-2">
          <label htmlFor="backgroundStory" className="text-sm font-medium text-t1">
            배경 이야기
          </label>
          <textarea
            id="backgroundStory"
            value={form.backgroundStory}
            onChange={(e) => setForm((p) => ({ ...p, backgroundStory: e.target.value }))}
            maxLength={3000}
            rows={5}
            placeholder="캐릭터의 과거와 배경을 입력해주세요 (최대 3000자)"
            className="bg-bg2 border border-bg3 focus:border-red/50 rounded-lg px-4 py-2.5 text-sm text-t1 placeholder:text-t2 outline-none resize-none transition-colors"
          />
          <p className="text-xs text-t2 text-right">{form.backgroundStory.length} / 3000</p>
        </div>

        {/* 첫 인사말 */}
        <div className="flex flex-col gap-2">
          <label htmlFor="firstMessage" className="text-sm font-medium text-t1">
            첫 인사말
          </label>
          <textarea
            id="firstMessage"
            value={form.firstMessage}
            onChange={(e) => setForm((p) => ({ ...p, firstMessage: e.target.value }))}
            maxLength={500}
            rows={3}
            placeholder="채팅 시작 시 캐릭터가 처음 건네는 말 (최대 500자)"
            className="bg-bg2 border border-bg3 focus:border-red/50 rounded-lg px-4 py-2.5 text-sm text-t1 placeholder:text-t2 outline-none resize-none transition-colors"
          />
          <p className="text-xs text-t2 text-right">{form.firstMessage.length} / 500</p>
        </div>

        {/* 아바타 이미지 URL */}
        <div className="flex flex-col gap-2">
          <label htmlFor="avatar" className="text-sm font-medium text-t1">
            아바타 이미지 URL
          </label>
          <input
            id="avatar"
            type="url"
            value={form.avatar}
            onChange={(e) => setForm((p) => ({ ...p, avatar: e.target.value }))}
            maxLength={500}
            placeholder="https://example.com/avatar.jpg"
            className="bg-bg2 border border-bg3 focus:border-red/50 rounded-lg px-4 py-2.5 text-sm text-t1 placeholder:text-t2 outline-none transition-colors"
          />
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
            placeholder="태그를 쉼표로 구분하여 입력 (예: 판타지, 엘프, 마법사)"
            className="bg-bg2 border border-bg3 focus:border-red/50 rounded-lg px-4 py-2.5 text-sm text-t1 placeholder:text-t2 outline-none transition-colors"
          />
          <p className="text-xs text-t2">쉼표(,)로 구분하여 최대 20개 입력 가능</p>
        </div>

        {/* 공개 범위 */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-t1">공개 범위</span>
          <div className="flex flex-col gap-2">
            {CHAR_VISIBILITIES.map(({ value, label }) => (
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

        {/* 제출 버튼 */}
        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-red hover:bg-red/80 disabled:bg-red/40 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            {submitting ? "생성 중..." : "캐릭터 만들기"}
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
