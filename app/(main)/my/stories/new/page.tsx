"use client";

// 스토리 생성 — WRTN 스타일 3탭 다단계 폼
// 프로필 탭 → 스토리 설정 탭 → 공개 설정 탭 → POST /api/stories
import { useState, useRef, KeyboardEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { GENRES } from "@/lib/constants/genres";
import ImageGenModal from "@/components/ui/ImageGenModal";

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────
const TABS = [
  { id: "profile",  label: "프로필",      required: true },
  { id: "settings", label: "스토리 설정", required: true },
  { id: "publish",  label: "공개 설정",   required: true },
] as const;

type TabId = (typeof TABS)[number]["id"];

const STORY_STATUSES = [
  { value: "ONGOING",   label: "연재 중" },
  { value: "COMPLETED", label: "완결" },
  { value: "HIATUS",    label: "휴재" },
] as const;

const STORY_VISIBILITIES = [
  { value: "PUBLIC",   label: "공개",                     desc: "모든 사용자에게 공개됩니다" },
  { value: "UNLISTED", label: "링크 공개",                desc: "링크가 있는 사용자만 볼 수 있습니다" },
  { value: "PRIVATE",  label: "비공개",                   desc: "나만 볼 수 있습니다" },
] as const;

// localStorage 임시저장 키
const LS_DRAFT_KEY = "saga-story-draft";

// ─────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────
type FormState = {
  title: string;
  summary: string;       // 한 줄 소개 (max 100)
  description: string;   // 상세 설명 (max 500)
  genre: string[];
  tags: string[];
  status: string;
  visibility: string;
  coverImage: string;
};

const DEFAULT_FORM: FormState = {
  title: "",
  summary: "",
  description: "",
  genre: [],
  tags: [],
  status: "ONGOING",
  visibility: "PUBLIC",
  coverImage: "",
};

// ─────────────────────────────────────────────
// 보조 컴포넌트: 탭 헤더
// ─────────────────────────────────────────────
function TabBar({
  activeTab,
  onTabChange,
}: {
  activeTab: TabId;
  onTabChange: (t: TabId) => void;
}) {
  return (
    <div className="flex border-b border-bg3 overflow-x-auto scrollbar-hide">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={[
            "flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors relative",
            activeTab === tab.id
              ? "text-t1 border-b-2 border-red"
              : "text-t2 hover:text-t1",
          ].join(" ")}
        >
          {tab.label}
          {tab.required && (
            <span className="text-red ml-0.5 text-xs">*</span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// 보조 컴포넌트: 태그 칩 입력
// ─────────────────────────────────────────────
function TagInput({
  tags,
  onTagsChange,
}: {
  tags: string[];
  onTagsChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function addTag(raw: string) {
    const trimmed = raw.trim().replace(/^#/, "");
    if (!trimmed || tags.includes(trimmed) || tags.length >= 20) return;
    onTagsChange([...tags, trimmed]);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(input);
      setInput("");
    } else if (e.key === "Backspace" && input === "" && tags.length > 0) {
      onTagsChange(tags.slice(0, -1));
    }
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (val.includes(",")) {
      val.split(",").forEach((t) => addTag(t));
      setInput("");
    } else {
      setInput(val);
    }
  }

  function removeTag(t: string) {
    onTagsChange(tags.filter((x) => x !== t));
  }

  return (
    <div className="flex flex-wrap gap-1.5 bg-bg2 border border-bg3 focus-within:border-red/50 rounded-lg px-3 py-2 min-h-[44px] cursor-text transition-colors">
      {tags.map((t) => (
        <span
          key={t}
          className="flex items-center gap-1 bg-bg3 text-t1 text-xs px-2 py-1 rounded-md"
        >
          #{t}
          <button
            type="button"
            onClick={() => removeTag(t)}
            className="text-t2 hover:text-red transition-colors ml-0.5"
          >
            ×
          </button>
        </span>
      ))}
      {tags.length < 20 && (
        <input
          type="text"
          value={input}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? "태그 입력 후 Enter 또는 쉼표 (최대 20개)" : ""}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-t1 placeholder:text-t2 outline-none"
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────
export default function StoryNewPage() {
  const { status } = useSession();
  const router = useRouter();

  if (status === "unauthenticated") {
    router.replace("/login");
    return null;
  }

  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [form, setForm] = useState<FormState>(() => {
    // localStorage 임시저장 복원
    try {
      const saved = localStorage.getItem(LS_DRAFT_KEY);
      if (saved) return { ...DEFAULT_FORM, ...JSON.parse(saved) };
    } catch { /* ignore */ }
    return { ...DEFAULT_FORM };
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [imageGenOpen, setImageGenOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── 폼 업데이트 헬퍼 ──
  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // ── 임시저장 (localStorage) ──
  function saveDraft() {
    try {
      localStorage.setItem(LS_DRAFT_KEY, JSON.stringify(form));
      setDraftSaved(true);
      setTimeout(() => setDraftSaved(false), 2000);
    } catch { /* ignore */ }
  }

  // ── AI 랜덤 생성 (제목 + 소개) ──
  async function handleRandomGenerate() {
    if (aiLoading) return;
    setAiLoading(true);
    try {
      const genre = form.genre.length > 0 ? form.genre.join(", ") : "판타지";
      const res = await fetch("/api/ai/story-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ genre }),
      });
      if (res.ok) {
        const data = await res.json() as { title: string; summary: string };
        setForm((prev) => ({
          ...prev,
          title: data.title ?? prev.title,
          summary: data.summary ?? prev.summary,
        }));
      }
    } catch { /* ignore */ }
    setAiLoading(false);
  }

  // ── 장르 토글 ──
  function toggleGenre(g: string) {
    setField(
      "genre",
      form.genre.includes(g)
        ? form.genre.filter((x) => x !== g)
        : [...form.genre, g]
    );
  }

  // ── 탭 이동 ──
  const tabOrder: TabId[] = ["profile", "settings", "publish"];
  function goNext() {
    const idx = tabOrder.indexOf(activeTab);
    if (idx < tabOrder.length - 1) setActiveTab(tabOrder[idx + 1]);
  }
  function goPrev() {
    const idx = tabOrder.indexOf(activeTab);
    if (idx > 0) setActiveTab(tabOrder[idx - 1]);
  }

  // ── 탭 유효성 검사 ──
  function validateCurrent(): string | null {
    if (activeTab === "profile") {
      if (form.title.trim().length < 1) return "제목을 입력해주세요.";
      if (form.summary.trim().length < 1) return "한 줄 소개를 입력해주세요.";
    }
    if (activeTab === "settings") {
      if (form.genre.length === 0) return "장르를 최소 하나 선택해주세요.";
    }
    return null;
  }

  // ── 다음 탭 ──
  function handleNext() {
    const err = validateCurrent();
    if (err) { setErrorMsg(err); return; }
    setErrorMsg(null);
    goNext();
  }

  // ── 최종 저장 ──
  async function handleSubmit() {
    if (form.title.trim().length === 0) { setErrorMsg("제목을 입력해주세요."); setActiveTab("profile"); return; }
    if (form.genre.length === 0) { setErrorMsg("장르를 최소 하나 선택해주세요."); setActiveTab("settings"); return; }
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || form.summary.trim() || undefined,
          genre: form.genre,
          tags: form.tags,
          status: form.status,
          visibility: form.visibility,
          coverImage: form.coverImage.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "요청 실패" }));
        setErrorMsg(body.error ?? "스토리 생성에 실패했습니다.");
        return;
      }
      // 임시저장 데이터 삭제
      try { localStorage.removeItem(LS_DRAFT_KEY); } catch { /* ignore */ }
      router.push("/my");
    } catch {
      setErrorMsg("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  const isLastTab = activeTab === "publish";
  const isFirstTab = activeTab === "profile";

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* ── 헤더 ── */}
      <header className="h-14 bg-bg2 border-b border-bg3 flex items-center px-4 gap-3 shrink-0 sticky top-0 z-10">
        <button
          type="button"
          onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center text-t2 hover:text-t1 transition-colors rounded-lg hover:bg-bg3"
          aria-label="뒤로"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <h1 className="text-base font-bold text-t1 flex-1">스토리 만들기</h1>
        <button
          type="button"
          onClick={saveDraft}
          className="text-xs text-t2 hover:text-t1 transition-colors px-3 py-1.5 rounded-lg border border-bg3 hover:border-t2/50"
        >
          {draftSaved ? "✓ 저장됨" : "임시저장"}
        </button>
      </header>

      {/* ── 탭 바 ── */}
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* ── 에러 ── */}
      {errorMsg && (
        <div className="mx-4 mt-4 px-4 py-3 bg-red/10 border border-red/30 rounded-lg text-red text-sm">
          {errorMsg}
        </div>
      )}

      {/* ── 탭 콘텐츠 ── */}
      <div className="flex-1 overflow-y-auto pb-24">

        {/* ===== 프로필 탭 ===== */}
        {activeTab === "profile" && (
          <div className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-6">
            {/* AI 랜덤 생성 배너 */}
            <div className="flex items-center justify-between bg-bg2 border border-bg3 rounded-xl px-4 py-3">
              <p className="text-xs text-t2">프로필을 AI로 자동 생성해 보세요</p>
              <button
                type="button"
                onClick={handleRandomGenerate}
                disabled={aiLoading}
                className="text-xs text-red hover:text-red/80 font-medium transition-colors disabled:opacity-50"
              >
                {aiLoading ? "생성 중..." : "✨ 랜덤 생성"}
              </button>
            </div>

            {/* 커버 이미지 */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-t1">
                커버 이미지 <span className="text-red">*</span>
              </label>
              <div className="flex gap-4 items-start">
                {/* 미리보기 */}
                <div className="shrink-0 w-24 h-36 rounded-xl bg-bg3 border border-bg3 overflow-hidden flex items-center justify-center">
                  {form.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.coverImage} alt="커버" className="w-full h-full object-cover" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-t2" aria-hidden="true">
                      <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                      <circle cx="8.5" cy="8.5" r="1.5"/>
                      <polyline points="21 15 16 10 5 21"/>
                    </svg>
                  )}
                </div>
                {/* 버튼 + URL 입력 */}
                <div className="flex-1 flex flex-col gap-2">
                  <p className="text-xs text-t2 leading-relaxed">
                    이미지를 업로드하거나 URL을 입력하세요.<br/>
                    권장 비율: 2:3 (예: 600×900px)
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 border border-bg3 hover:border-t2/50 text-t2 hover:text-t1 rounded-lg transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      업로드
                    </button>
                    {form.coverImage && (
                      <button
                        type="button"
                        onClick={() => setField("coverImage", "")}
                        className="text-xs px-3 py-1.5 border border-bg3 hover:border-red/40 text-t2 hover:text-red rounded-lg transition-colors"
                      >
                        삭제
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setImageGenOpen(true)}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 border border-bg3 hover:border-red/40 text-t2 hover:text-red rounded-lg transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      AI 생성
                    </button>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const url = URL.createObjectURL(file);
                        setField("coverImage", url);
                      }
                    }}
                  />
                  <input
                    type="url"
                    value={form.coverImage}
                    onChange={(e) => setField("coverImage", e.target.value)}
                    placeholder="또는 이미지 URL 직접 입력"
                    className="bg-bg2 border border-bg3 focus:border-red/50 rounded-lg px-3 py-2 text-xs text-t1 placeholder:text-t2 outline-none transition-colors"
                  />
                </div>
              </div>
            </div>

            {/* 제목 */}
            <div className="flex flex-col gap-2">
              <label htmlFor="title" className="text-sm font-medium text-t1">
                제목 <span className="text-red">*</span>
              </label>
              <input
                id="title"
                type="text"
                value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                maxLength={50}
                placeholder="2~50자 이내로 입력해 주세요"
                className="bg-bg2 border border-bg3 focus:border-red/50 rounded-lg px-4 py-2.5 text-sm text-t1 placeholder:text-t2 outline-none transition-colors"
              />
              <p className="text-xs text-t2 text-right">{form.title.length} / 50</p>
            </div>

            {/* 한 줄 소개 */}
            <div className="flex flex-col gap-2">
              <label htmlFor="summary" className="text-sm font-medium text-t1">
                한 줄 소개 <span className="text-red">*</span>
              </label>
              <textarea
                id="summary"
                value={form.summary}
                onChange={(e) => setField("summary", e.target.value)}
                maxLength={100}
                rows={2}
                placeholder="어떤 스토리인지 간단히 소개해 주세요"
                className="bg-bg2 border border-bg3 focus:border-red/50 rounded-lg px-4 py-2.5 text-sm text-t1 placeholder:text-t2 outline-none resize-none transition-colors"
              />
              <p className="text-xs text-t2 text-right">{form.summary.length} / 100</p>
            </div>
          </div>
        )}

        {/* ===== 스토리 설정 탭 ===== */}
        {activeTab === "settings" && (
          <div className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-6">
            {/* 장르 */}
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
                      className={[
                        "text-xs px-3 py-1.5 rounded-full border transition-colors",
                        checked
                          ? "bg-red/20 border-red/50 text-red font-medium"
                          : "bg-bg2 border-bg3 text-t2 hover:border-t2/50 hover:text-t1",
                      ].join(" ")}
                    >
                      {g}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 태그 */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-t1">태그</label>
              <TagInput tags={form.tags} onTagsChange={(t) => setField("tags", t)} />
              <p className="text-xs text-t2">{form.tags.length} / 20개</p>
            </div>

            {/* 연재 상태 */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-t1">연재 상태</span>
              <div className="flex gap-2">
                {STORY_STATUSES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setField("status", value)}
                    className={[
                      "flex-1 py-2 text-sm rounded-lg border transition-colors",
                      form.status === value
                        ? "bg-red/20 border-red/50 text-red font-medium"
                        : "bg-bg2 border-bg3 text-t2 hover:border-t2/50 hover:text-t1",
                    ].join(" ")}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 상세 설명 */}
            <div className="flex flex-col gap-2">
              <label htmlFor="description" className="text-sm font-medium text-t1">
                상세 설명
              </label>
              <textarea
                id="description"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                maxLength={500}
                rows={5}
                placeholder="스토리의 배경, 세계관, 주요 등장인물 등을 자세히 설명해 주세요 (최대 500자)"
                className="bg-bg2 border border-bg3 focus:border-red/50 rounded-lg px-4 py-2.5 text-sm text-t1 placeholder:text-t2 outline-none resize-none transition-colors"
              />
              <p className="text-xs text-t2 text-right">{form.description.length} / 500</p>
            </div>
          </div>
        )}

        {/* ===== 공개 설정 탭 ===== */}
        {activeTab === "publish" && (
          <div className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-6">
            {/* 공개 범위 */}
            <div className="flex flex-col gap-3">
              <span className="text-sm font-medium text-t1">
                공개 범위 <span className="text-red">*</span>
              </span>
              {STORY_VISIBILITIES.map(({ value, label, desc }) => (
                <label
                  key={value}
                  className={[
                    "flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors",
                    form.visibility === value
                      ? "bg-red/5 border-red/40"
                      : "bg-bg2 border-bg3 hover:border-t2/30",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={value}
                    checked={form.visibility === value}
                    onChange={() => setField("visibility", value)}
                    className="accent-red mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium text-t1">{label}</p>
                    <p className="text-xs text-t2 mt-0.5">{desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* 요약 확인 */}
            <div className="bg-bg2 border border-bg3 rounded-xl p-4 flex flex-col gap-3">
              <p className="text-xs font-semibold text-t1">최종 확인</p>
              <div className="flex gap-3">
                {form.coverImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.coverImage} alt="커버" className="w-12 h-18 object-cover rounded-lg shrink-0" style={{height: "72px"}} />
                )}
                <div className="flex flex-col gap-1 text-xs text-t2">
                  <p className="text-t1 font-medium text-sm">{form.title || "(제목 없음)"}</p>
                  <p className="line-clamp-2">{form.summary || "(소개 없음)"}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {form.genre.map((g) => (
                      <span key={g} className="bg-bg3 text-t2 px-2 py-0.5 rounded-full text-xs">{g}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 주의사항 */}
            <div className="flex gap-2 bg-bg2 border border-bg3 rounded-xl px-4 py-3">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-t2 shrink-0 mt-0.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p className="text-xs text-t2 leading-relaxed">
                폭력, 혐오, 성적묘사 등의 표현 및 이미지는 규정에 따라 영구적으로 제재될 수 있어요
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── 하단 고정 버튼바 ── */}
      <div className="fixed bottom-0 left-0 right-0 bg-bg border-t border-bg3 px-4 py-3 flex items-center gap-3 z-10">
        {!isFirstTab && (
          <button
            type="button"
            onClick={goPrev}
            className="px-5 py-2.5 border border-bg3 hover:border-t2/50 text-t2 hover:text-t1 text-sm rounded-lg transition-colors"
          >
            이전
          </button>
        )}
        {isLastTab ? (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 bg-red hover:bg-red/80 disabled:bg-red/40 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            {submitting ? "저장 중..." : "스토리 등록"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            className="flex-1 bg-red hover:bg-red/80 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
          >
            다음
          </button>
        )}
      </div>

      {/* AI 이미지 생성 모달 */}
      <ImageGenModal
        open={imageGenOpen}
        onClose={() => setImageGenOpen(false)}
        defaultPrompt={
          form.title
            ? `${form.title} 스토리 커버 이미지, book cover, cinematic, detailed`
            : "story book cover, cinematic, detailed, fantasy"
        }
        onGenerated={(url) => {
          setField("coverImage", url);
          setImageGenOpen(false);
        }}
      />
    </div>
  );
}
