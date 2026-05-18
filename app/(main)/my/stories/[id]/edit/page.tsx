"use client";

// 스토리 수정 — 6탭 다단계 폼 (Phase 1~4 고도화)
// 프로필 / 스토리설정 / 시작설정 / 스탯설정 / 엔딩설정 / 공개설정
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  KeyboardEvent,
  ChangeEvent,
} from "react";
import { useRouter, useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import useSWR, { mutate as swrMutate } from "swr";
import { GENRES } from "@/lib/constants/genres";
import ImageGenModal from "@/components/ui/ImageGenModal";

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────
const TABS = [
  { id: "profile",   label: "프로필",      required: true },
  { id: "story",     label: "스토리 설정", required: false },
  { id: "start",     label: "시작 설정",   required: false },
  { id: "stats",     label: "스탯 설정",   required: false },
  { id: "endings",   label: "엔딩 설정",   required: false },
  { id: "media",     label: "미디어",      required: false },
  { id: "publish",   label: "공개 설정",   required: true },
] as const;

type TabId = (typeof TABS)[number]["id"];

const STORY_STATUSES = [
  { value: "ONGOING",   label: "연재 중" },
  { value: "COMPLETED", label: "완결" },
  { value: "HIATUS",    label: "휴재" },
] as const;

const STORY_VISIBILITIES = [
  { value: "PUBLIC",   label: "공개",      desc: "모든 사용자에게 공개됩니다" },
  { value: "UNLISTED", label: "링크 공개", desc: "링크가 있는 사용자만 볼 수 있습니다" },
  { value: "PRIVATE",  label: "비공개",    desc: "나만 볼 수 있습니다" },
] as const;

const PROMPT_TEMPLATES = [
  { value: "basic",      label: "기본",       desc: "일반적인 소설 서술" },
  { value: "roleplay",   label: "롤플레이",   desc: "캐릭터 중심 대화형" },
  { value: "simulation", label: "시뮬레이션", desc: "세계관 중심 선택형" },
  { value: "custom",     label: "커스텀",     desc: "storyInfo 기반 자유 설정" },
] as const;

const STAT_ICONS = ["heart", "star", "circle", "shield", "fire", "sword", "key", "crown", "gem", "bolt"] as const;
const STAT_COLORS = ["red", "orange", "yellow", "green", "blue", "purple", "pink", "teal", "gray"] as const;
const ENDING_GRADES = ["N", "R", "SR", "SSR"] as const;
const OPERATORS = ["gt", "gte", "lt", "lte", "eq", "ne"] as const;
const OPERATOR_LABELS: Record<string, string> = { gt: ">", gte: "≥", lt: "<", lte: "≤", eq: "=", ne: "≠" };

const CONVERSATION_FORMATS = [
  { value: "CHAT",  label: "채팅형" },
  { value: "NOVEL", label: "소설형" },
  { value: "GAME",  label: "게임형" },
] as const;

const STORY_TARGETS = [
  { value: "ALL",   label: "전체 이용가" },
  { value: "TEEN",  label: "청소년 이용가" },
  { value: "ADULT", label: "성인용" },
] as const;

// ─────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────
type ExampleDialog = { user: string; ai: string };

type StatLevel = {
  id?: string;
  name: string;
  minVal: number;
  maxVal: number;
  prompt: string;
  sortOrder: number;
};

type StatDef = {
  id: string;
  name: string;
  icon: string;
  color: string;
  unit: string;
  minVal: number;
  maxVal: number;
  defaultVal: number;
  description: string;
  sortOrder: number;
  levels: StatLevel[];
};

type EndingCondition = {
  id?: string;
  statDefId: string;
  operator: string;
  value: number;
  groupId: number;
};

type Ending = {
  id: string;
  grade: string;
  name: string;
  image: string;
  prompt: string;
  epilogue: string;
  hint: string;
  minTurn: number;
  startTurn: number;
  sortOrder: number;
  conditions: EndingCondition[];
};

type StoryDetail = {
  id: string;
  title: string;
  description: string | null;
  genre: string[];
  tags: string[];
  status: string;
  visibility: string;
  coverImage: string | null;
  promptTemplate: string;
  storyInfo: string | null;
  exampleDialogs: ExampleDialog[];
  prologue: string | null;
  startContext: string | null;
  playGuide: string | null;
  tagline: string | null;
  hashtags: string[];
  maxOutput: number;
  isAdult: boolean;
  target: string | null;
  conversationFormat: string | null;
};

type FormState = {
  title: string;
  summary: string;
  description: string;
  genre: string[];
  tags: string[];
  status: string;
  visibility: string;
  coverImage: string;
  promptTemplate: string;
  storyInfo: string;
  exampleDialogs: ExampleDialog[];
  prologue: string;
  startContext: string;
  playGuide: string;
  tagline: string;
  hashtags: string[];
  maxOutput: number;
  isAdult: boolean;
  target: string;
  conversationFormat: string;
};

const fetcher = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "요청 실패" }));
    throw new Error(err.error ?? "요청 실패");
  }
  return res.json();
};

// ─────────────────────────────────────────────
// 보조 컴포넌트: 탭 헤더
// ─────────────────────────────────────────────
function TabBar({ activeTab, onTabChange }: { activeTab: TabId; onTabChange: (t: TabId) => void }) {
  return (
    <div className="flex border-b border-bg3 overflow-x-auto scrollbar-hide">
      {TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onTabChange(tab.id)}
          className={[
            "flex-shrink-0 px-4 py-3 text-sm font-medium transition-colors",
            activeTab === tab.id ? "text-t1 border-b-2 border-red" : "text-t2 hover:text-t1",
          ].join(" ")}
        >
          {tab.label}{tab.required && <span className="text-red ml-0.5 text-xs">*</span>}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// 보조 컴포넌트: 태그 칩 입력
// ─────────────────────────────────────────────
function TagInput({ tags, onTagsChange, max = 20 }: { tags: string[]; onTagsChange: (t: string[]) => void; max?: number }) {
  const [input, setInput] = useState("");
  function addTag(raw: string) {
    const t = raw.trim().replace(/^#/, "");
    if (!t || tags.includes(t) || tags.length >= max) return;
    onTagsChange([...tags, t]);
  }
  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(input); setInput(""); }
    else if (e.key === "Backspace" && input === "" && tags.length > 0) onTagsChange(tags.slice(0, -1));
  }
  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    if (val.includes(",")) { val.split(",").forEach((t) => addTag(t)); setInput(""); }
    else setInput(val);
  }
  return (
    <div className="flex flex-wrap gap-1.5 bg-bg2 border border-bg3 focus-within:border-red/50 rounded-lg px-3 py-2 min-h-[44px] transition-colors">
      {tags.map((t) => (
        <span key={t} className="flex items-center gap-1 bg-bg3 text-t1 text-xs px-2 py-1 rounded-md">
          #{t}
          <button type="button" onClick={() => onTagsChange(tags.filter((x) => x !== t))} className="text-t2 hover:text-red transition-colors ml-0.5">×</button>
        </span>
      ))}
      {tags.length < max && (
        <input type="text" value={input} onChange={handleChange} onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? `태그 입력 후 Enter 또는 쉼표 (최대 ${max}개)` : ""}
          className="flex-1 min-w-[120px] bg-transparent text-sm text-t1 placeholder:text-t2 outline-none" />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 스탯 아이콘 렌더
// ─────────────────────────────────────────────
const COLOR_MAP: Record<string, string> = {
  red: "text-red-400", orange: "text-orange-400", yellow: "text-yellow-400",
  green: "text-green-400", blue: "text-blue-400", purple: "text-purple-400",
  pink: "text-pink-400", teal: "text-teal-400", gray: "text-gray-400",
};

function StatIcon({ icon, color }: { icon: string; color: string }) {
  const cls = COLOR_MAP[color] ?? "text-gray-400";
  const icons: Record<string, string> = {
    heart: "♥", star: "★", circle: "●", shield: "🛡", fire: "🔥",
    sword: "⚔", key: "🔑", crown: "👑", gem: "💎", bolt: "⚡",
  };
  return <span className={`text-sm ${cls}`}>{icons[icon] ?? "●"}</span>;
}

// ─────────────────────────────────────────────
// 스탯 설정 탭
// ─────────────────────────────────────────────
function StatsTab({ storyId }: { storyId: string }) {
  const { data, error, isLoading } = useSWR<{ statDefs: StatDef[] }>(
    `/api/stories/${storyId}/stats`, fetcher
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<StatDef>>({});
  const [createForm, setCreateForm] = useState<Partial<StatDef>>({});
  const [showCreate, setShowCreate] = useState(false);

  async function handleCreate() {
    if (!createForm.name?.trim()) return;
    setSaving("create");
    try {
      await fetch(`/api/stories/${storyId}/stats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createForm.name,
          icon: createForm.icon ?? "circle",
          color: createForm.color ?? "yellow",
          unit: createForm.unit ?? "",
          minVal: createForm.minVal ?? 0,
          maxVal: createForm.maxVal ?? 100,
          defaultVal: createForm.defaultVal ?? 50,
          description: createForm.description ?? "",
          levels: createForm.levels ?? [],
        }),
      });
      await swrMutate(`/api/stories/${storyId}/stats`);
      setCreateForm({});
      setShowCreate(false);
    } finally {
      setSaving(null);
    }
  }

  async function handleSave(statId: string) {
    setSaving(statId);
    try {
      await fetch(`/api/stories/${storyId}/stats/${statId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      await swrMutate(`/api/stories/${storyId}/stats`);
      setEditingId(null);
    } finally {
      setSaving(null);
    }
  }

  async function handleDelete(statId: string) {
    if (!confirm("이 스탯을 삭제하시겠습니까?")) return;
    setSaving(statId);
    try {
      await fetch(`/api/stories/${storyId}/stats/${statId}`, { method: "DELETE" });
      await swrMutate(`/api/stories/${storyId}/stats`);
    } finally {
      setSaving(null);
    }
  }

  function startEdit(stat: StatDef) {
    setEditingId(stat.id);
    setEditForm({ ...stat });
  }

  if (isLoading) return <div className="px-4 py-8 text-center text-t2 text-sm">불러오는 중...</div>;
  if (error) return <div className="px-4 py-8 text-center text-red text-sm">오류: {error.message}</div>;

  const statDefs = data?.statDefs ?? [];

  return (
    <div className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-t1">커스텀 스탯 ({statDefs.length}/20)</p>
        <button type="button" onClick={() => setShowCreate(true)}
          disabled={statDefs.length >= 20}
          className="text-xs px-3 py-1.5 bg-red/20 hover:bg-red/30 text-red rounded-lg transition-colors disabled:opacity-40">
          + 스탯 추가
        </button>
      </div>

      {/* 스탯 생성 폼 */}
      {showCreate && (
        <div className="bg-bg2 border border-bg3 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-t1">새 스탯 추가</p>
          <StatEditForm form={createForm} onChange={setCreateForm} statDefs={[]} />
          <div className="flex gap-2 mt-1">
            <button type="button" onClick={handleCreate} disabled={saving === "create"}
              className="flex-1 text-xs py-2 bg-red hover:bg-red/80 disabled:bg-red/40 text-white rounded-lg transition-colors">
              {saving === "create" ? "저장 중..." : "추가"}
            </button>
            <button type="button" onClick={() => { setShowCreate(false); setCreateForm({}); }}
              className="text-xs px-4 py-2 border border-bg3 text-t2 rounded-lg hover:border-t2/50">취소</button>
          </div>
        </div>
      )}

      {statDefs.length === 0 && (
        <p className="text-center text-t2 text-sm py-6">스탯이 없습니다. 추가해보세요.</p>
      )}

      {statDefs.map((stat) => (
        <div key={stat.id} className="bg-bg2 border border-bg3 rounded-xl p-4 flex flex-col gap-3">
          {editingId === stat.id ? (
            <>
              <StatEditForm form={editForm} onChange={setEditForm} statDefs={statDefs.filter(s => s.id !== stat.id)} />
              <div className="flex gap-2">
                <button type="button" onClick={() => handleSave(stat.id)} disabled={saving === stat.id}
                  className="flex-1 text-xs py-2 bg-red hover:bg-red/80 disabled:bg-red/40 text-white rounded-lg transition-colors">
                  {saving === stat.id ? "저장 중..." : "저장"}
                </button>
                <button type="button" onClick={() => setEditingId(null)}
                  className="text-xs px-4 py-2 border border-bg3 text-t2 rounded-lg hover:border-t2/50">취소</button>
              </div>
            </>
          ) : (
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <StatIcon icon={stat.icon} color={stat.color} />
                <div>
                  <p className="text-sm font-medium text-t1">{stat.name}{stat.unit && <span className="text-xs text-t2 ml-1">({stat.unit})</span>}</p>
                  <p className="text-xs text-t2">{stat.minVal}~{stat.maxVal} / 기본: {stat.defaultVal}</p>
                  {stat.description && <p className="text-xs text-t2 mt-0.5 line-clamp-1">{stat.description}</p>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button type="button" onClick={() => startEdit(stat)}
                  className="text-xs px-2 py-1 text-t2 hover:text-t1 border border-bg3 rounded-lg hover:border-t2/50 transition-colors">수정</button>
                <button type="button" onClick={() => handleDelete(stat.id)} disabled={saving === stat.id}
                  className="text-xs px-2 py-1 text-red/70 hover:text-red border border-bg3 rounded-lg hover:border-red/30 transition-colors">삭제</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// 스탯 수정 폼 서브컴포넌트
function StatEditForm({
  form,
  onChange,
  statDefs: _statDefs,
}: {
  form: Partial<StatDef>;
  onChange: (f: Partial<StatDef>) => void;
  statDefs: StatDef[];
}) {
  const [showLevels, setShowLevels] = useState(false);

  function setF(key: keyof StatDef, value: unknown) {
    onChange({ ...form, [key]: value });
  }

  const levels: StatLevel[] = form.levels ?? [];

  function addLevel() {
    setF("levels", [...levels, { name: "", minVal: 0, maxVal: 100, prompt: "", sortOrder: levels.length }]);
  }

  function updateLevel(idx: number, key: keyof StatLevel, value: unknown) {
    const updated = levels.map((l, i) => i === idx ? { ...l, [key]: value } : l);
    setF("levels", updated);
  }

  function removeLevel(idx: number) {
    setF("levels", levels.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-t2 mb-1 block">이름 *</label>
          <input type="text" value={form.name ?? ""} onChange={(e) => setF("name", e.target.value)}
            maxLength={10} placeholder="스탯 이름"
            className="w-full bg-bg border border-bg3 rounded-lg px-3 py-1.5 text-sm text-t1 outline-none focus:border-red/50" />
        </div>
        <div>
          <label className="text-xs text-t2 mb-1 block">단위</label>
          <input type="text" value={form.unit ?? ""} onChange={(e) => setF("unit", e.target.value)}
            maxLength={3} placeholder="%"
            className="w-16 bg-bg border border-bg3 rounded-lg px-2 py-1.5 text-sm text-t1 outline-none focus:border-red/50" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-t2 mb-1 block">아이콘</label>
          <select value={form.icon ?? "circle"} onChange={(e) => setF("icon", e.target.value)}
            className="w-full bg-bg border border-bg3 rounded-lg px-2 py-1.5 text-sm text-t1 outline-none focus:border-red/50">
            {STAT_ICONS.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs text-t2 mb-1 block">색상</label>
          <select value={form.color ?? "yellow"} onChange={(e) => setF("color", e.target.value)}
            className="w-full bg-bg border border-bg3 rounded-lg px-2 py-1.5 text-sm text-t1 outline-none focus:border-red/50">
            {STAT_COLORS.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-t2 mb-1 block">최솟값</label>
          <input type="number" value={form.minVal ?? 0} onChange={(e) => setF("minVal", Number(e.target.value))}
            className="w-full bg-bg border border-bg3 rounded-lg px-2 py-1.5 text-sm text-t1 outline-none focus:border-red/50" />
        </div>
        <div className="flex-1">
          <label className="text-xs text-t2 mb-1 block">최댓값</label>
          <input type="number" value={form.maxVal ?? 100} onChange={(e) => setF("maxVal", Number(e.target.value))}
            className="w-full bg-bg border border-bg3 rounded-lg px-2 py-1.5 text-sm text-t1 outline-none focus:border-red/50" />
        </div>
        <div className="flex-1">
          <label className="text-xs text-t2 mb-1 block">기본값</label>
          <input type="number" value={form.defaultVal ?? 50} onChange={(e) => setF("defaultVal", Number(e.target.value))}
            className="w-full bg-bg border border-bg3 rounded-lg px-2 py-1.5 text-sm text-t1 outline-none focus:border-red/50" />
        </div>
      </div>
      <div>
        <label className="text-xs text-t2 mb-1 block">AI 판단 기준 설명</label>
        <textarea value={form.description ?? ""} onChange={(e) => setF("description", e.target.value)}
          maxLength={500} rows={2} placeholder="이 스탯을 AI가 어떻게 판단할지 설명"
          className="w-full bg-bg border border-bg3 rounded-lg px-3 py-2 text-sm text-t1 outline-none focus:border-red/50 resize-none" />
      </div>
      {/* 레벨 */}
      <div>
        <button type="button" onClick={() => setShowLevels(v => !v)}
          className="text-xs text-t2 hover:text-t1 flex items-center gap-1">
          {showLevels ? "▼" : "▶"} 레벨 설정 ({levels.length}개)
        </button>
        {showLevels && (
          <div className="mt-2 flex flex-col gap-2">
            {levels.map((lv, idx) => (
              <div key={idx} className="bg-bg border border-bg3 rounded-lg p-2 flex flex-col gap-1.5">
                <div className="flex gap-2">
                  <input type="text" value={lv.name} onChange={(e) => updateLevel(idx, "name", e.target.value)}
                    maxLength={10} placeholder="레벨명"
                    className="flex-1 bg-bg2 border border-bg3 rounded px-2 py-1 text-xs text-t1 outline-none" />
                  <input type="number" value={lv.minVal} onChange={(e) => updateLevel(idx, "minVal", Number(e.target.value))}
                    className="w-16 bg-bg2 border border-bg3 rounded px-2 py-1 text-xs text-t1 outline-none" placeholder="min" />
                  <input type="number" value={lv.maxVal} onChange={(e) => updateLevel(idx, "maxVal", Number(e.target.value))}
                    className="w-16 bg-bg2 border border-bg3 rounded px-2 py-1 text-xs text-t1 outline-none" placeholder="max" />
                  <button type="button" onClick={() => removeLevel(idx)} className="text-xs text-red/70 hover:text-red px-1">✕</button>
                </div>
                <input type="text" value={lv.prompt} onChange={(e) => updateLevel(idx, "prompt", e.target.value)}
                  maxLength={100} placeholder="레벨별 AI 지시사항 (100자)"
                  className="bg-bg2 border border-bg3 rounded px-2 py-1 text-xs text-t1 outline-none" />
              </div>
            ))}
            <button type="button" onClick={addLevel}
              className="text-xs text-t2 hover:text-t1 py-1 border border-dashed border-bg3 rounded-lg hover:border-t2/50 transition-colors">
              + 레벨 추가
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 엔딩 설정 탭
// ─────────────────────────────────────────────
function EndingsTab({ storyId }: { storyId: string }) {
  const { data: endingsData, error: endingsError, isLoading: endingsLoading } = useSWR<{ endings: Ending[] }>(
    `/api/stories/${storyId}/endings`, fetcher
  );
  const { data: statsData } = useSWR<{ statDefs: StatDef[] }>(
    `/api/stories/${storyId}/stats`, fetcher
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Ending>>({});
  const [createForm, setCreateForm] = useState<Partial<Ending>>({});
  const [showCreate, setShowCreate] = useState(false);

  const statDefs = statsData?.statDefs ?? [];

  async function handleCreate() {
    if (!createForm.name?.trim()) return;
    setSaving("create");
    try {
      await fetch(`/api/stories/${storyId}/endings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grade: createForm.grade ?? "N",
          name: createForm.name,
          image: createForm.image ?? null,
          prompt: createForm.prompt ?? "",
          epilogue: createForm.epilogue ?? null,
          hint: createForm.hint ?? null,
          minTurn: createForm.minTurn ?? 10,
          startTurn: createForm.startTurn ?? 10,
          conditions: createForm.conditions ?? [],
        }),
      });
      await swrMutate(`/api/stories/${storyId}/endings`);
      setCreateForm({});
      setShowCreate(false);
    } finally {
      setSaving(null);
    }
  }

  async function handleSave(endingId: string) {
    setSaving(endingId);
    try {
      await fetch(`/api/stories/${storyId}/endings/${endingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      await swrMutate(`/api/stories/${storyId}/endings`);
      setEditingId(null);
    } finally {
      setSaving(null);
    }
  }

  async function handleDelete(endingId: string) {
    if (!confirm("이 엔딩을 삭제하시겠습니까?")) return;
    setSaving(endingId);
    try {
      await fetch(`/api/stories/${storyId}/endings/${endingId}`, { method: "DELETE" });
      await swrMutate(`/api/stories/${storyId}/endings`);
    } finally {
      setSaving(null);
    }
  }

  const GRADE_COLORS: Record<string, string> = {
    N: "text-gray-400 border-gray-600/40",
    R: "text-blue-400 border-blue-600/40",
    SR: "text-purple-400 border-purple-600/40",
    SSR: "text-yellow-400 border-yellow-600/40",
  };

  if (endingsLoading) return <div className="px-4 py-8 text-center text-t2 text-sm">불러오는 중...</div>;
  if (endingsError) return <div className="px-4 py-8 text-center text-red text-sm">오류: {endingsError.message}</div>;

  const endings = endingsData?.endings ?? [];

  return (
    <div className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-t1">엔딩 설정 ({endings.length}/30)</p>
        <button type="button" onClick={() => setShowCreate(true)}
          disabled={endings.length >= 30}
          className="text-xs px-3 py-1.5 bg-red/20 hover:bg-red/30 text-red rounded-lg transition-colors disabled:opacity-40">
          + 엔딩 추가
        </button>
      </div>

      {showCreate && (
        <div className="bg-bg2 border border-bg3 rounded-xl p-4 flex flex-col gap-3">
          <p className="text-xs font-semibold text-t1">새 엔딩 추가</p>
          <EndingEditForm form={createForm} onChange={setCreateForm} statDefs={statDefs} />
          <div className="flex gap-2 mt-1">
            <button type="button" onClick={handleCreate} disabled={saving === "create"}
              className="flex-1 text-xs py-2 bg-red hover:bg-red/80 disabled:bg-red/40 text-white rounded-lg">
              {saving === "create" ? "저장 중..." : "추가"}
            </button>
            <button type="button" onClick={() => { setShowCreate(false); setCreateForm({}); }}
              className="text-xs px-4 py-2 border border-bg3 text-t2 rounded-lg hover:border-t2/50">취소</button>
          </div>
        </div>
      )}

      {endings.length === 0 && (
        <p className="text-center text-t2 text-sm py-6">엔딩이 없습니다. 추가해보세요.</p>
      )}

      {endings.map((ending) => (
        <div key={ending.id} className="bg-bg2 border border-bg3 rounded-xl p-4 flex flex-col gap-3">
          {editingId === ending.id ? (
            <>
              <EndingEditForm form={editForm} onChange={setEditForm} statDefs={statDefs} />
              <div className="flex gap-2">
                <button type="button" onClick={() => handleSave(ending.id)} disabled={saving === ending.id}
                  className="flex-1 text-xs py-2 bg-red hover:bg-red/80 disabled:bg-red/40 text-white rounded-lg">
                  {saving === ending.id ? "저장 중..." : "저장"}
                </button>
                <button type="button" onClick={() => setEditingId(null)}
                  className="text-xs px-4 py-2 border border-bg3 text-t2 rounded-lg hover:border-t2/50">취소</button>
              </div>
            </>
          ) : (
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-1.5 py-0.5 border rounded font-bold ${GRADE_COLORS[ending.grade] ?? ""}`}>
                    {ending.grade}
                  </span>
                  <p className="text-sm font-medium text-t1">{ending.name}</p>
                </div>
                <p className="text-xs text-t2">{ending.startTurn}턴 이후 조건 체크 · 조건 {ending.conditions.length}개</p>
                {ending.hint && <p className="text-xs text-t2/60 mt-0.5">힌트: {ending.hint}</p>}
              </div>
              <div className="flex gap-1 shrink-0">
                <button type="button" onClick={() => { setEditingId(ending.id); setEditForm({ ...ending }); }}
                  className="text-xs px-2 py-1 text-t2 hover:text-t1 border border-bg3 rounded-lg hover:border-t2/50 transition-colors">수정</button>
                <button type="button" onClick={() => handleDelete(ending.id)}
                  className="text-xs px-2 py-1 text-red/70 hover:text-red border border-bg3 rounded-lg hover:border-red/30 transition-colors">삭제</button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// 엔딩 수정 폼 서브컴포넌트
function EndingEditForm({
  form,
  onChange,
  statDefs,
}: {
  form: Partial<Ending>;
  onChange: (f: Partial<Ending>) => void;
  statDefs: StatDef[];
}) {
  function setF(key: keyof Ending, value: unknown) {
    onChange({ ...form, [key]: value });
  }

  const conditions: EndingCondition[] = form.conditions ?? [];

  function addCondition() {
    const newCond: EndingCondition = {
      statDefId: statDefs[0]?.id ?? "",
      operator: "gte",
      value: 50,
      groupId: 0,
    };
    setF("conditions", [...conditions, newCond]);
  }

  function updateCondition(idx: number, key: keyof EndingCondition, value: unknown) {
    const updated = conditions.map((c, i) => i === idx ? { ...c, [key]: value } : c);
    setF("conditions", updated);
  }

  function removeCondition(idx: number) {
    setF("conditions", conditions.filter((_, i) => i !== idx));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <div>
          <label className="text-xs text-t2 mb-1 block">등급</label>
          <select value={form.grade ?? "N"} onChange={(e) => setF("grade", e.target.value)}
            className="bg-bg border border-bg3 rounded-lg px-2 py-1.5 text-sm text-t1 outline-none focus:border-red/50">
            {ENDING_GRADES.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-xs text-t2 mb-1 block">엔딩 이름 *</label>
          <input type="text" value={form.name ?? ""} onChange={(e) => setF("name", e.target.value)}
            maxLength={20} placeholder="엔딩 이름"
            className="w-full bg-bg border border-bg3 rounded-lg px-3 py-1.5 text-sm text-t1 outline-none focus:border-red/50" />
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-t2 mb-1 block">최소 턴</label>
          <input type="number" value={form.minTurn ?? 10} onChange={(e) => setF("minTurn", Number(e.target.value))}
            className="w-full bg-bg border border-bg3 rounded-lg px-2 py-1.5 text-sm text-t1 outline-none focus:border-red/50" />
        </div>
        <div className="flex-1">
          <label className="text-xs text-t2 mb-1 block">체크 시작 턴</label>
          <input type="number" value={form.startTurn ?? 10} onChange={(e) => setF("startTurn", Number(e.target.value))}
            className="w-full bg-bg border border-bg3 rounded-lg px-2 py-1.5 text-sm text-t1 outline-none focus:border-red/50" />
        </div>
      </div>
      <div>
        <label className="text-xs text-t2 mb-1 block">AI 조건 프롬프트</label>
        <textarea value={form.prompt ?? ""} onChange={(e) => setF("prompt", e.target.value)}
          maxLength={500} rows={2} placeholder="이 엔딩이 발동되는 조건 설명 (AI용)"
          className="w-full bg-bg border border-bg3 rounded-lg px-3 py-2 text-sm text-t1 outline-none focus:border-red/50 resize-none" />
      </div>
      <div>
        <label className="text-xs text-t2 mb-1 block">에필로그</label>
        <textarea value={form.epilogue ?? ""} onChange={(e) => setF("epilogue", e.target.value)}
          maxLength={1000} rows={3} placeholder="엔딩 에필로그 텍스트 (1000자)"
          className="w-full bg-bg border border-bg3 rounded-lg px-3 py-2 text-sm text-t1 outline-none focus:border-red/50 resize-none" />
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <label className="text-xs text-t2 mb-1 block">힌트 (유저 표시)</label>
          <input type="text" value={form.hint ?? ""} onChange={(e) => setF("hint", e.target.value)}
            maxLength={20} placeholder="힌트 텍스트"
            className="w-full bg-bg border border-bg3 rounded-lg px-3 py-1.5 text-sm text-t1 outline-none focus:border-red/50" />
        </div>
        <div className="flex-1">
          <label className="text-xs text-t2 mb-1 block">이미지 URL</label>
          <input type="text" value={form.image ?? ""} onChange={(e) => setF("image", e.target.value)}
            placeholder="https://..."
            className="w-full bg-bg border border-bg3 rounded-lg px-3 py-1.5 text-sm text-t1 outline-none focus:border-red/50" />
        </div>
      </div>

      {/* 스탯 조건 */}
      {statDefs.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-t2">스탯 조건 ({conditions.length}개)</label>
            <button type="button" onClick={addCondition}
              className="text-xs text-t2 hover:text-t1 px-2 py-0.5 border border-dashed border-bg3 rounded hover:border-t2/50">
              + 조건 추가
            </button>
          </div>
          {conditions.map((cond, idx) => (
            <div key={idx} className="flex items-center gap-1 mb-1.5">
              <select value={cond.statDefId} onChange={(e) => updateCondition(idx, "statDefId", e.target.value)}
                className="flex-1 bg-bg border border-bg3 rounded px-2 py-1 text-xs text-t1 outline-none">
                {statDefs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select value={cond.operator} onChange={(e) => updateCondition(idx, "operator", e.target.value)}
                className="w-14 bg-bg border border-bg3 rounded px-1 py-1 text-xs text-t1 outline-none">
                {OPERATORS.map(op => <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>)}
              </select>
              <input type="number" value={cond.value} onChange={(e) => updateCondition(idx, "value", Number(e.target.value))}
                className="w-16 bg-bg border border-bg3 rounded px-2 py-1 text-xs text-t1 outline-none" />
              <button type="button" onClick={() => removeCondition(idx)} className="text-red/70 hover:text-red text-xs px-1">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 미디어 탭
// ─────────────────────────────────────────────
type MediaItem = {
  id: string;
  category: string;
  situation: string;
  imageUrl: string;
  filename: string;
  fileSize: number;
  createdAt: string;
};

function MediaTab({ storyId }: { storyId: string }) {
  const { data, error, isLoading, mutate: mutatMedia } = useSWR<{ mediaItems: MediaItem[]; grouped: Record<string, MediaItem[]> }>(
    `/api/stories/${storyId}/media`,
    fetcher
  );

  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [deleteErr, setDeleteErr] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [situation, setSituation] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const mediaItems = data?.mediaItems ?? [];
  const grouped = data?.grouped ?? {};
  const categories = Object.keys(grouped).sort();

  async function uploadFile(file: File) {
    setUploading(true);
    setUploadErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (category.trim()) fd.append("category", category.trim());
      if (situation.trim()) fd.append("situation", situation.trim());

      const res = await fetch(`/api/stories/${storyId}/media`, { method: "POST", body: fd });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setUploadErr(json.error ?? "업로드 실패");
        return;
      }
      await mutatMedia();
      setCategory("");
      setSituation("");
    } catch {
      setUploadErr("네트워크 오류");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(mediaId: string) {
    setDeleteErr(null);
    try {
      const res = await fetch(`/api/stories/${storyId}/media/${mediaId}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "삭제 실패" })) as { error?: string };
        setDeleteErr(body.error ?? "삭제에 실패했습니다.");
        return;
      }
      await mutatMedia();
    } catch {
      setDeleteErr("네트워크 오류로 삭제에 실패했습니다.");
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void uploadFile(file);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  }

  if (isLoading) {
    return <div className="px-4 py-10 text-center text-sm text-t2">불러오는 중...</div>;
  }
  if (error) {
    return <div className="px-4 py-10 text-center text-sm text-red">미디어를 불러올 수 없습니다.</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 flex flex-col gap-6">
      {/* 업로드 영역 */}
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-t1">이미지 업로드 ({mediaItems.length}/1000)</p>

        {/* 분류/상황 입력 */}
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text" maxLength={20} value={category}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setCategory(e.target.value)}
            placeholder="분류 (예: 에피)"
            className="bg-bg2 border border-bg3 focus:border-red/50 rounded-xl px-3 py-2 text-sm text-t1 placeholder:text-t2/40 outline-none"
          />
          <input
            type="text" maxLength={20} value={situation}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setSituation(e.target.value)}
            placeholder="상황 (예: 기쁨)"
            className="bg-bg2 border border-bg3 focus:border-red/50 rounded-xl px-3 py-2 text-sm text-t1 placeholder:text-t2/40 outline-none"
          />
        </div>
        <p className="text-xs text-t2/60">비워두면 파일명에서 자동 파싱: <code className="text-t2">분류_상황.jpg</code></p>

        {/* 드래그 앤 드롭 업로드 존 */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={[
            "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors",
            dragOver ? "border-red/60 bg-red/5" : "border-bg3 hover:border-t2/30 hover:bg-bg2",
            uploading ? "opacity-50 pointer-events-none" : "",
          ].join(" ")}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-t2" aria-hidden="true">
            <polyline points="16 16 12 12 8 16"/><line x1="12" y1="12" x2="12" y2="21"/>
            <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3"/>
          </svg>
          <p className="text-sm text-t2">{uploading ? "업로드 중..." : "클릭하거나 파일을 드래그하세요"}</p>
          <p className="text-xs text-t2/50">JPG, PNG, WebP, GIF · 최대 5MB</p>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
        {uploadErr && <p className="text-xs text-red">{uploadErr}</p>}
        {deleteErr && <p className="text-xs text-red">{deleteErr}</p>}
      </div>

      {/* 배치표 (분류×상황 그리드) */}
      {mediaItems.length === 0 ? (
        <div className="text-center py-8 text-sm text-t2">
          등록된 미디어가 없습니다. 이미지를 업로드해 주세요.
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <p className="text-sm font-medium text-t1">배치표</p>
          {categories.map((cat) => (
            <div key={cat} className="flex flex-col gap-2">
              <p className="text-xs font-semibold text-t2 uppercase tracking-wide">{cat}</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {(grouped[cat] ?? []).map((item) => (
                  <div key={item.id} className="relative group rounded-xl overflow-hidden bg-bg2 border border-bg3 aspect-[2/3]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.imageUrl}
                      alt={`${item.category}_${item.situation}`}
                      className="w-full h-full object-cover"
                    />
                    {/* 호버 오버레이 */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-2">
                      <p className="text-white text-xs font-medium text-center leading-tight">{item.situation}</p>
                      <button
                        type="button"
                        onClick={() => void handleDelete(item.id)}
                        className="mt-1 px-2 py-1 bg-red/80 hover:bg-red text-white text-xs rounded-lg transition-colors"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────
export default function StoryEditPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const storyId = params.id;

  if (status === "unauthenticated") { router.replace("/login"); return null; }

  const { data: story, error: loadError, isLoading } = useSWR<StoryDetail>(
    storyId ? `/api/stories/${storyId}` : null, fetcher
  );

  const [activeTab, setActiveTab] = useState<TabId>("profile");
  const [form, setForm] = useState<FormState>({
    title: "", summary: "", description: "", genre: [], tags: [],
    status: "ONGOING", visibility: "PUBLIC", coverImage: "",
    promptTemplate: "basic", storyInfo: "", exampleDialogs: [],
    prologue: "", startContext: "", playGuide: "",
    tagline: "", hashtags: [], maxOutput: 1024,
    isAdult: false, target: "", conversationFormat: "",
  });
  const [initialized, setInitialized] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedOk, setSavedOk] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [imageGenOpen, setImageGenOpen] = useState(false);
  const [aiGenerating, setAiGenerating] = useState<"storyInfo" | "prologue" | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (story && !initialized) {
      setForm({
        title: story.title,
        summary: story.tagline ?? story.description?.slice(0, 100) ?? "",
        description: story.description ?? "",
        genre: story.genre,
        tags: story.tags,
        status: story.status,
        visibility: story.visibility,
        coverImage: story.coverImage ?? "",
        promptTemplate: story.promptTemplate ?? "basic",
        storyInfo: story.storyInfo ?? "",
        exampleDialogs: story.exampleDialogs ?? [],
        prologue: story.prologue ?? "",
        startContext: story.startContext ?? "",
        playGuide: story.playGuide ?? "",
        tagline: story.tagline ?? "",
        hashtags: story.hashtags ?? [],
        maxOutput: story.maxOutput ?? 1024,
        isAdult: story.isAdult ?? false,
        target: story.target ?? "",
        conversationFormat: story.conversationFormat ?? "",
      });
      setInitialized(true);
    }
  }, [story, initialized]);

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleGenre(g: string) {
    setField("genre", form.genre.includes(g) ? form.genre.filter((x) => x !== g) : [...form.genre, g]);
  }

  // 전개 예시 관리
  function addExample() {
    if (form.exampleDialogs.length >= 3) return;
    setField("exampleDialogs", [...form.exampleDialogs, { user: "", ai: "" }]);
  }
  function updateExample(idx: number, key: "user" | "ai", val: string) {
    const updated = form.exampleDialogs.map((ex, i) => i === idx ? { ...ex, [key]: val } : ex);
    setField("exampleDialogs", updated);
  }
  function removeExample(idx: number) {
    setField("exampleDialogs", form.exampleDialogs.filter((_, i) => i !== idx));
  }

  // AI 자동 생성 (storyInfo / prologue)
  const handleAutoGenerate = useCallback(async (type: "storyInfo" | "prologue") => {
    setAiGenerating(type);
    try {
      const res = await fetch("/api/ai/story-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title,
          description: form.description || form.summary,
          genre: form.genre,
          type,
        }),
      });
      if (res.ok) {
        const data = await res.json() as { result: string };
        if (type === "storyInfo") setField("storyInfo", data.result ?? "");
        else setField("prologue", data.result ?? "");
      }
    } finally {
      setAiGenerating(null);
    }
  }, [form.title, form.description, form.summary, form.genre]);

  async function handleSubmit() {
    if (form.title.trim().length === 0) { setErrorMsg("제목을 입력해주세요."); setActiveTab("profile"); return; }
    if (form.genre.length === 0) { setErrorMsg("장르를 최소 하나 선택해주세요."); setActiveTab("story"); return; }
    setErrorMsg(null); setSubmitting(true);
    try {
      const res = await fetch(`/api/stories/${storyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          genre: form.genre,
          tags: form.tags,
          status: form.status,
          visibility: form.visibility,
          coverImage: form.coverImage.trim() || null,
          promptTemplate: form.promptTemplate,
          storyInfo: form.storyInfo.trim() || null,
          exampleDialogs: form.exampleDialogs,
          prologue: form.prologue.trim() || null,
          startContext: form.startContext.trim() || null,
          playGuide: form.playGuide.trim() || null,
          tagline: form.tagline.trim() || null,
          hashtags: form.hashtags,
          maxOutput: form.maxOutput,
          isAdult: form.isAdult,
          target: form.target || null,
          conversationFormat: form.conversationFormat || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "요청 실패" }));
        setErrorMsg(body.error ?? "스토리 수정에 실패했습니다.");
        return;
      }
      setSavedOk(true);
      setTimeout(() => { setSavedOk(false); router.push("/my"); }, 1200);
    } catch {
      setErrorMsg("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-bg2 rounded w-1/3" />
          <div className="h-12 bg-bg2 rounded" />
          <div className="h-32 bg-bg2 rounded" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 text-center">
        <p className="text-red mb-2">스토리를 불러오지 못했습니다.</p>
        <p className="text-sm text-t2">{loadError.message}</p>
      </div>
    );
  }

  // 스탯/엔딩/미디어 탭은 별도 저장 방식 (즉시 API 호출)
  const isStatOrEndingTab = activeTab === "stats" || activeTab === "endings" || activeTab === "media";
  const isLastTab = activeTab === "publish";
  const tabOrder: TabId[] = TABS.map(t => t.id);
  function goNext() { const i = tabOrder.indexOf(activeTab); if (i < tabOrder.length - 1) setActiveTab(tabOrder[i + 1]); }
  function goPrev() { const i = tabOrder.indexOf(activeTab); if (i > 0) setActiveTab(tabOrder[i - 1]); }
  const isFirstTab = activeTab === "profile";

  return (
    <div className="min-h-screen flex flex-col bg-bg">
      {/* 헤더 */}
      <header className="h-14 bg-bg2 border-b border-bg3 flex items-center px-4 gap-3 shrink-0 sticky top-0 z-10">
        <button type="button" onClick={() => router.back()}
          className="w-8 h-8 flex items-center justify-center text-t2 hover:text-t1 transition-colors rounded-lg hover:bg-bg3" aria-label="뒤로">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h1 className="text-base font-bold text-t1 flex-1">스토리 수정</h1>
        {savedOk && <span className="text-xs text-green-400">✓ 저장됨</span>}
      </header>

      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {errorMsg && (
        <div className="mx-4 mt-4 px-4 py-3 bg-red/10 border border-red/30 rounded-lg text-red text-sm">{errorMsg}</div>
      )}

      <div className="flex-1 overflow-y-auto pb-24">

        {/* ===== 프로필 탭 ===== */}
        {activeTab === "profile" && (
          <div className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-6">
            {/* 커버 이미지 */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-t1">커버 이미지</label>
              <div className="flex gap-4 items-start">
                <div className="shrink-0 w-24 h-36 rounded-xl bg-bg3 border border-bg3 overflow-hidden flex items-center justify-center">
                  {form.coverImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.coverImage} alt="커버" className="w-full h-full object-cover" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-t2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  )}
                </div>
                <div className="flex-1 flex flex-col gap-2">
                  <p className="text-xs text-t2 leading-relaxed">이미지를 업로드하거나 URL을 입력하세요.<br/>권장 비율: 2:3</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 border border-bg3 hover:border-t2/50 text-t2 hover:text-t1 rounded-lg transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                      업로드
                    </button>
                    {form.coverImage && (
                      <button type="button" onClick={() => setField("coverImage", "")}
                        className="text-xs px-3 py-1.5 border border-bg3 hover:border-red/40 text-t2 hover:text-red rounded-lg transition-colors">삭제</button>
                    )}
                    <button type="button" onClick={() => setImageGenOpen(true)}
                      className="flex items-center gap-1 text-xs px-3 py-1.5 border border-bg3 hover:border-red/40 text-t2 hover:text-red rounded-lg transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                      AI 생성
                    </button>
                  </div>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) setField("coverImage", URL.createObjectURL(file));
                    }} />
                  <input type="url" value={form.coverImage} onChange={(e) => setField("coverImage", e.target.value)}
                    placeholder="또는 이미지 URL 직접 입력"
                    className="bg-bg2 border border-bg3 focus:border-red/50 rounded-lg px-3 py-2 text-xs text-t1 placeholder:text-t2 outline-none transition-colors" />
                </div>
              </div>
            </div>

            {/* 제목 */}
            <div className="flex flex-col gap-2">
              <label htmlFor="title" className="text-sm font-medium text-t1">제목 <span className="text-red">*</span></label>
              <input id="title" type="text" value={form.title}
                onChange={(e) => setField("title", e.target.value)}
                maxLength={50} placeholder="2~50자 이내로 입력해 주세요"
                className="bg-bg2 border border-bg3 focus:border-red/50 rounded-lg px-4 py-2.5 text-sm text-t1 placeholder:text-t2 outline-none transition-colors" />
              <p className="text-xs text-t2 text-right">{form.title.length} / 50</p>
            </div>

            {/* tagline */}
            <div className="flex flex-col gap-2">
              <label htmlFor="tagline" className="text-sm font-medium text-t1">한 줄 소개</label>
              <textarea id="tagline" value={form.tagline}
                onChange={(e) => setField("tagline", e.target.value)}
                maxLength={30} rows={2} placeholder="30자 이내의 짧은 소개"
                className="bg-bg2 border border-bg3 focus:border-red/50 rounded-lg px-4 py-2.5 text-sm text-t1 placeholder:text-t2 outline-none resize-none transition-colors" />
              <p className="text-xs text-t2 text-right">{form.tagline.length} / 30</p>
            </div>
          </div>
        )}

        {/* ===== 스토리 설정 탭 ===== */}
        {activeTab === "story" && (
          <div className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-6">
            {/* 장르 */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-t1">장르 <span className="text-red">*</span></span>
              <div className="flex flex-wrap gap-2">
                {GENRES.map((g) => {
                  const checked = form.genre.includes(g);
                  return (
                    <button key={g} type="button" onClick={() => toggleGenre(g)}
                      className={["text-xs px-3 py-1.5 rounded-full border transition-colors",
                        checked ? "bg-red/20 border-red/50 text-red font-medium" : "bg-bg2 border-bg3 text-t2 hover:border-t2/50 hover:text-t1"].join(" ")}>
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
                  <button key={value} type="button" onClick={() => setField("status", value)}
                    className={["flex-1 py-2 text-sm rounded-lg border transition-colors",
                      form.status === value ? "bg-red/20 border-red/50 text-red font-medium" : "bg-bg2 border-bg3 text-t2 hover:border-t2/50 hover:text-t1"].join(" ")}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 상세 설명 */}
            <div className="flex flex-col gap-2">
              <label htmlFor="description" className="text-sm font-medium text-t1">상세 설명</label>
              <textarea id="description" value={form.description}
                onChange={(e) => setField("description", e.target.value)}
                maxLength={500} rows={4} placeholder="스토리 배경 소개 (최대 500자)"
                className="bg-bg2 border border-bg3 focus:border-red/50 rounded-lg px-4 py-2.5 text-sm text-t1 placeholder:text-t2 outline-none resize-none transition-colors" />
              <p className="text-xs text-t2 text-right">{form.description.length} / 500</p>
            </div>

            {/* 프롬프트 템플릿 */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-t1">프롬프트 템플릿</span>
              <div className="grid grid-cols-2 gap-2">
                {PROMPT_TEMPLATES.map(({ value, label, desc }) => (
                  <button key={value} type="button" onClick={() => setField("promptTemplate", value)}
                    className={["p-3 rounded-xl border text-left transition-colors",
                      form.promptTemplate === value ? "bg-red/5 border-red/40" : "bg-bg2 border-bg3 hover:border-t2/30"].join(" ")}>
                    <p className="text-sm font-medium text-t1">{label}</p>
                    <p className="text-xs text-t2 mt-0.5">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* storyInfo */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-t1">세계관/등장인물 정보</label>
                <button type="button" onClick={() => handleAutoGenerate("storyInfo")}
                  disabled={aiGenerating !== null}
                  className="flex items-center gap-1 text-xs px-3 py-1 border border-bg3 hover:border-red/40 text-t2 hover:text-red rounded-lg transition-colors disabled:opacity-40">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  {aiGenerating === "storyInfo" ? "생성 중..." : "자동 생성"}
                </button>
              </div>
              <textarea value={form.storyInfo}
                onChange={(e) => setField("storyInfo", e.target.value)}
                maxLength={4000} rows={8}
                placeholder="AI가 스토리를 생성할 때 참고할 세계관, 등장인물, 규칙 등을 자세히 기술해주세요. (최대 4000자)"
                className="bg-bg2 border border-bg3 focus:border-red/50 rounded-lg px-4 py-2.5 text-sm text-t1 placeholder:text-t2 outline-none resize-none transition-colors" />
              <p className="text-xs text-t2 text-right">{form.storyInfo.length} / 4000</p>
            </div>

            {/* 전개 예시 */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-t1">전개 예시 ({form.exampleDialogs.length}/3)</span>
                {form.exampleDialogs.length < 3 && (
                  <button type="button" onClick={addExample}
                    className="text-xs px-3 py-1 border border-bg3 hover:border-red/40 text-t2 hover:text-red rounded-lg transition-colors">
                    + 예시 추가
                  </button>
                )}
              </div>
              {form.exampleDialogs.map((ex, idx) => (
                <div key={idx} className="bg-bg2 border border-bg3 rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-t2">예시 {idx + 1}</p>
                    <button type="button" onClick={() => removeExample(idx)} className="text-xs text-red/60 hover:text-red">삭제</button>
                  </div>
                  <div>
                    <label className="text-xs text-t2 mb-1 block">유저 입력</label>
                    <textarea value={ex.user} onChange={(e) => updateExample(idx, "user", e.target.value)}
                      maxLength={500} rows={2} placeholder="유저가 입력할 내용"
                      className="w-full bg-bg border border-bg3 focus:border-red/50 rounded-lg px-3 py-2 text-sm text-t1 placeholder:text-t2 outline-none resize-none transition-colors" />
                  </div>
                  <div>
                    <label className="text-xs text-t2 mb-1 block">AI 출력</label>
                    <textarea value={ex.ai} onChange={(e) => updateExample(idx, "ai", e.target.value)}
                      maxLength={500} rows={3} placeholder="AI가 응답할 내용"
                      className="w-full bg-bg border border-bg3 focus:border-red/50 rounded-lg px-3 py-2 text-sm text-t1 placeholder:text-t2 outline-none resize-none transition-colors" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ===== 시작 설정 탭 ===== */}
        {activeTab === "start" && (
          <div className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-6">
            {/* 프롤로그 */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-t1">플레이 오프닝 (프롤로그)</label>
                <button type="button" onClick={() => handleAutoGenerate("prologue")}
                  disabled={aiGenerating !== null}
                  className="flex items-center gap-1 text-xs px-3 py-1 border border-bg3 hover:border-red/40 text-t2 hover:text-red rounded-lg transition-colors disabled:opacity-40">
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  {aiGenerating === "prologue" ? "생성 중..." : "자동 생성"}
                </button>
              </div>
              <textarea value={form.prologue}
                onChange={(e) => setField("prologue", e.target.value)}
                maxLength={1000} rows={6}
                placeholder="플레이 시작 시 가장 먼저 표시될 텍스트. 분위기를 잡아주는 도입부 (최대 1000자)"
                className="bg-bg2 border border-bg3 focus:border-red/50 rounded-lg px-4 py-2.5 text-sm text-t1 placeholder:text-t2 outline-none resize-none transition-colors" />
              <p className="text-xs text-t2 text-right">{form.prologue.length} / 1000</p>
            </div>

            {/* startContext */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-t1">AI 시작 상황 (내부용)</label>
              <textarea value={form.startContext}
                onChange={(e) => setField("startContext", e.target.value)}
                maxLength={1000} rows={5}
                placeholder="AI에게 전달할 시작 상황 설명. 유저에게는 표시되지 않습니다. (최대 1000자)"
                className="bg-bg2 border border-bg3 focus:border-red/50 rounded-lg px-4 py-2.5 text-sm text-t1 placeholder:text-t2 outline-none resize-none transition-colors" />
              <p className="text-xs text-t2 text-right">{form.startContext.length} / 1000</p>
            </div>

            {/* playGuide */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-t1">플레이 가이드 (유저용)</label>
              <textarea value={form.playGuide}
                onChange={(e) => setField("playGuide", e.target.value)}
                maxLength={500} rows={4}
                placeholder="플레이 화면 상단에 접이식으로 표시될 가이드. AI에게는 전달되지 않습니다. (최대 500자)"
                className="bg-bg2 border border-bg3 focus:border-red/50 rounded-lg px-4 py-2.5 text-sm text-t1 placeholder:text-t2 outline-none resize-none transition-colors" />
              <p className="text-xs text-t2 text-right">{form.playGuide.length} / 500</p>
            </div>
          </div>
        )}

        {/* ===== 스탯 설정 탭 (즉시저장 방식) ===== */}
        {activeTab === "stats" && storyId && (
          <StatsTab storyId={storyId} />
        )}

        {/* ===== 엔딩 설정 탭 (즉시저장 방식) ===== */}
        {activeTab === "endings" && storyId && (
          <EndingsTab storyId={storyId} />
        )}

        {/* ===== 미디어 탭 (즉시저장 방식) ===== */}
        {activeTab === "media" && storyId && (
          <MediaTab storyId={storyId} />
        )}

        {/* ===== 공개 설정 탭 ===== */}
        {activeTab === "publish" && (
          <div className="max-w-xl mx-auto px-4 py-6 flex flex-col gap-6">
            {/* 공개 범위 */}
            <div className="flex flex-col gap-3">
              <span className="text-sm font-medium text-t1">공개 범위 <span className="text-red">*</span></span>
              {STORY_VISIBILITIES.map(({ value, label, desc }) => (
                <label key={value}
                  className={["flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors",
                    form.visibility === value ? "bg-red/5 border-red/40" : "bg-bg2 border-bg3 hover:border-t2/30"].join(" ")}>
                  <input type="radio" name="visibility" value={value}
                    checked={form.visibility === value}
                    onChange={() => setForm((p) => ({ ...p, visibility: value }))}
                    className="mt-0.5 accent-red" />
                  <div>
                    <p className="text-sm font-medium text-t1">{label}</p>
                    <p className="text-xs text-t2 mt-0.5">{desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* 연재 상태 */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-t1">연재 상태</span>
              <div className="flex gap-2 flex-wrap">
                {STORY_STATUSES.map(({ value, label }) => (
                  <button key={value} type="button"
                    onClick={() => setForm((p) => ({ ...p, status: value }))}
                    className={["px-4 py-2 rounded-xl text-sm font-medium border transition-colors",
                      form.status === value ? "bg-red/20 text-red border-red/40" : "bg-bg2 text-t2 border-bg3 hover:border-t2/30"].join(" ")}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 한 줄 소개 */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-t1">한 줄 소개</label>
              <input type="text" maxLength={30} value={form.tagline}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, tagline: e.target.value }))}
                placeholder="스토리를 한 문장으로 소개하세요 (30자)"
                className="bg-bg2 border border-bg3 focus:border-red/50 rounded-xl px-4 py-2.5 text-sm text-t1 placeholder:text-t2/40 outline-none" />
              <p className="text-xs text-t2/60 text-right">{form.tagline.length}/30</p>
            </div>

            {/* 해시태그 */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-t1">해시태그</label>
              <TagInput
                tags={form.hashtags}
                onTagsChange={(tags) => setForm((p) => ({ ...p, hashtags: tags.slice(0, 30) }))}
                max={30}
              />
              <p className="text-xs text-t2/60">{form.hashtags.length}/30개</p>
            </div>

            {/* 이용 등급 */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-t1">이용 등급</span>
              <div className="flex gap-2 flex-wrap">
                {STORY_TARGETS.map(({ value, label }) => (
                  <button key={value} type="button"
                    onClick={() => setForm((p) => ({ ...p, target: value }))}
                    className={["px-4 py-2 rounded-xl text-sm font-medium border transition-colors",
                      form.target === value ? "bg-red/20 text-red border-red/40" : "bg-bg2 text-t2 border-bg3 hover:border-t2/30"].join(" ")}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 대화 형식 */}
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-t1">대화 형식</span>
              <div className="flex gap-2 flex-wrap">
                {CONVERSATION_FORMATS.map(({ value, label }) => (
                  <button key={value} type="button"
                    onClick={() => setForm((p) => ({ ...p, conversationFormat: value }))}
                    className={["px-4 py-2 rounded-xl text-sm font-medium border transition-colors",
                      form.conversationFormat === value ? "bg-red/20 text-red border-red/40" : "bg-bg2 text-t2 border-bg3 hover:border-t2/30"].join(" ")}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* 최대 출력 토큰 */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-t1">
                최대 출력 토큰 <span className="text-t2 font-normal">({form.maxOutput})</span>
              </label>
              <input type="range" min={256} max={8192} step={256} value={form.maxOutput}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, maxOutput: Number(e.target.value) }))}
                className="w-full accent-red" />
              <div className="flex justify-between text-xs text-t2/60">
                <span>256 (짧음)</span>
                <span>8192 (길음)</span>
              </div>
            </div>

            {/* 성인 콘텐츠 */}
            <label className="flex items-center justify-between px-4 py-3 bg-bg2 rounded-xl border border-bg3 cursor-pointer">
              <div>
                <p className="text-sm font-medium text-t1">성인 콘텐츠</p>
                <p className="text-xs text-t2 mt-0.5">19세 이상 이용자만 접근 가능합니다</p>
              </div>
              <button type="button"
                onClick={() => setForm((p) => ({ ...p, isAdult: !p.isAdult }))}
                className={["relative w-11 h-6 rounded-full transition-colors shrink-0",
                  form.isAdult ? "bg-red" : "bg-bg3"].join(" ")}>
                <span className={["absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
                  form.isAdult ? "translate-x-5" : "translate-x-0"].join(" ")} />
              </button>
            </label>
          </div>
        )}
      </div>

      {/* 하단 네비게이션 */}
      {isStatOrEndingTab ? (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-bg border-t border-bg3 flex justify-between">
          <button type="button" onClick={goPrev} disabled={isFirstTab}
            className="px-6 py-2.5 text-sm font-medium text-t2 hover:text-t1 disabled:opacity-30 transition-colors">
            이전
          </button>
          <button type="button" onClick={goNext} disabled={isLastTab}
            className="px-6 py-2.5 text-sm font-medium text-t2 hover:text-t1 disabled:opacity-30 transition-colors">
            다음
          </button>
        </div>
      ) : (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-bg border-t border-bg3 flex gap-3">
          {!isFirstTab && (
            <button type="button" onClick={goPrev}
              className="flex-1 py-3 rounded-xl text-sm font-medium transition-colors bg-bg3 text-t1 hover:bg-bg3/80"
            >
              이전
            </button>
          )}
          {isLastTab ? (
            <button type="button" onClick={() => void handleSubmit()} disabled={submitting}
              className="flex-1 py-3 rounded-xl text-sm font-medium transition-colors bg-red text-white hover:bg-red/80 disabled:opacity-40"
            >
              {submitting ? "저장 중..." : "저장"}
            </button>
          ) : (
            <button type="button" onClick={goNext}
              className="flex-1 py-3 rounded-xl text-sm font-medium transition-colors bg-red text-white hover:bg-red/80"
            >
              다음
            </button>
          )}
        </div>
      )}
    </div>
  );
}
