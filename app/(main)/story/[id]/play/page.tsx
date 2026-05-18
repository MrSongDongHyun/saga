"use client";

// 스토리 플레이 페이지 (Phase 1~4 고도화)
// 프롤로그 표시 + 플레이가이드 접이식 패널 + 커스텀 스탯 패널 + 엔딩 모달
import {
  useState,
  useEffect,
  useRef,
  useCallback,
  KeyboardEvent,
  ChangeEvent,
} from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { mutate as swrMutate } from "swr";
import Link from "next/link";

import {
  StartSettingsModal,
  type PlayerSetup,
} from "@/components/story/StartSettingsModal";
import { ModelDropdown } from "@/components/ui/ModelDropdown";
import { DEFAULT_MODEL, type ClaudeModelId } from "@/lib/constants/models";
import {
  CharacterStatusPanel,
  DEFAULT_STATUS,
  parseStatusUpdate,
  parseAIResponse,
  type CharacterStatus,
} from "@/components/story/CharacterStatusPanel";

// ─────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────

type ChapterSummary = {
  id: string;
  storyId: string;
  title: string;
  orderIndex: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

type ChapterDetail = ChapterSummary & { content: string };

type StoryDetail = {
  id: string;
  title: string;
  description: string | null;
  genre: string[];
  prologue: string | null;
  playGuide: string | null;
  storyInfo: string | null;
};

type PlayMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  choices?: string[];
  createdAt: string;
  mediaUrl?: string; // Phase 5: 상황 이미지 URL
};

type PlayProgress = {
  lastChapterId: string;
  completedChapterIds: string[];
};

type StatDef = {
  id: string;
  name: string;
  icon: string;
  color: string;
  unit: string | null;
  minVal: number;
  maxVal: number;
  defaultVal: number;
  levels: Array<{ name: string; minVal: number; maxVal: number }>;
};

type EndingDef = {
  id: string;
  grade: string;
  name: string;
  image: string | null;
  epilogue: string | null;
  hint: string | null;
};

// ─────────────────────────────────────────────
// localStorage 키
// ─────────────────────────────────────────────

function lsSetupKey(sid: string, bid?: string) {
  return bid ? `saga-play-setup-${sid}-b${bid}` : `saga-play-setup-${sid}`;
}
function lsStatusKey(sid: string, bid?: string) {
  return bid ? `saga-play-status-${sid}-b${bid}` : `saga-play-status-${sid}`;
}
function lsMsgKey(sid: string, cid: string, bid?: string) {
  return bid
    ? `saga-play-msg-${sid}-${cid}-b${bid}`
    : `saga-play-msg-${sid}-${cid}`;
}
function lsProgressKey(sid: string) {
  return `saga-play-progress-${sid}`;
}
function lsCustomStatsKey(sid: string, bid?: string) {
  return bid ? `saga-play-custom-${sid}-b${bid}` : `saga-play-custom-${sid}`;
}

// ─────────────────────────────────────────────
// 마크다운 파서
// ─────────────────────────────────────────────

function parseStoryMarkdown(text: string): React.ReactNode[] {
  const lines = text.split("\n");
  const nodes: React.ReactNode[] = [];
  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) nodes.push(<br key={`br-${lineIdx}`} />);
    const pattern = /(\*\*[^*]+\*\*|"[^"]*"|\*[^*]+\*)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let kc = 0;
    const lineNodes: React.ReactNode[] = [];
    while ((match = pattern.exec(line)) !== null) {
      const before = line.slice(lastIndex, match.index);
      if (before) lineNodes.push(<span key={`l${lineIdx}-p-${kc++}`}>{before}</span>);
      const token = match[0];
      if (token.startsWith("**") && token.endsWith("**")) {
        lineNodes.push(<span key={`l${lineIdx}-b-${kc++}`} className="text-t2">{token.slice(2, -2)}</span>);
      } else if (token.startsWith('"') && token.endsWith('"')) {
        lineNodes.push(<span key={`l${lineIdx}-q-${kc++}`} className="text-t1 font-medium">{token}</span>);
      } else if (token.startsWith("*") && token.endsWith("*")) {
        lineNodes.push(<em key={`l${lineIdx}-i-${kc++}`} className="opacity-70" style={{ fontStyle: "italic" }}>{token.slice(1, -1)}</em>);
      } else {
        lineNodes.push(<span key={`l${lineIdx}-r-${kc++}`}>{token}</span>);
      }
      lastIndex = match.index + token.length;
    }
    const tail = line.slice(lastIndex);
    if (tail) lineNodes.push(<span key={`l${lineIdx}-tail`}>{tail}</span>);
    nodes.push(<span key={`line-${lineIdx}`}>{lineNodes}</span>);
  });
  return nodes;
}

// ─────────────────────────────────────────────
// 아이콘 맵
// ─────────────────────────────────────────────
const ICON_MAP: Record<string, string> = {
  heart: "♥", star: "★", circle: "●", shield: "🛡", fire: "🔥",
  sword: "⚔", key: "🔑", crown: "👑", gem: "💎", bolt: "⚡",
};
const COLOR_MAP: Record<string, string> = {
  red: "text-red-400", orange: "text-orange-400", yellow: "text-yellow-400",
  green: "text-green-400", blue: "text-blue-400", purple: "text-purple-400",
  pink: "text-pink-400", teal: "text-teal-400", gray: "text-gray-400",
};

// ─────────────────────────────────────────────
// 보조 컴포넌트
// ─────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-bg">
      <div className="h-14 bg-bg2 border-b border-bg3 flex items-center px-4 gap-3 shrink-0">
        <div className="w-6 h-6 bg-bg3 rounded animate-pulse" />
        <div className="w-48 h-4 bg-bg3 rounded animate-pulse" />
      </div>
      <div className="flex-1 p-6 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 bg-bg3 rounded animate-pulse" style={{ width: `${70 + i * 7}%` }} />
        ))}
      </div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-bg gap-4">
      <p className="text-t2 text-sm">{message}</p>
      <Link href="/" className="text-red text-sm hover:underline">홈으로 돌아가기</Link>
    </div>
  );
}

function DotsTyping() {
  return (
    <div className="flex items-center gap-1 py-2">
      {[0, 160, 320].map((delay) => (
        <span key={delay} className="w-1.5 h-1.5 rounded-full bg-t2 animate-bounce"
          style={{ animationDelay: `${delay}ms`, animationDuration: "800ms" }} />
      ))}
    </div>
  );
}

// 커스텀 스탯 패널
function CustomStatPanel({
  statDefs,
  statValues,
  isOpen,
  onToggle,
}: {
  statDefs: StatDef[];
  statValues: Record<string, number>;
  isOpen: boolean;
  onToggle: () => void;
}) {
  if (statDefs.length === 0) return null;

  return (
    <>
      {/* 토글 버튼 */}
      <button
        type="button"
        onClick={onToggle}
        className="fixed right-0 top-1/2 -translate-y-1/2 z-30 w-8 h-16 bg-bg2 border border-bg3 border-r-0 rounded-l-lg flex items-center justify-center text-t2 hover:text-t1 hover:bg-bg3 transition-colors"
        style={{ right: isOpen ? "224px" : "0" }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {isOpen ? <polyline points="9 18 15 12 9 6" /> : <polyline points="15 18 9 12 15 6" />}
        </svg>
      </button>

      {/* 패널 */}
      <div className={`fixed top-14 bottom-0 right-0 z-20 w-56 bg-bg2 border-l border-bg3 flex flex-col overflow-y-auto transition-transform duration-300 ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="px-4 py-3 border-b border-bg3 flex items-center justify-between shrink-0">
          <p className="text-xs font-semibold text-t1">커스텀 스탯</p>
        </div>
        <div className="flex-1 px-3 py-3 space-y-3 overflow-y-auto">
          {statDefs.map((stat) => {
            const val = statValues[stat.id] ?? stat.defaultVal;
            const pct = stat.maxVal > stat.minVal
              ? Math.round(((val - stat.minVal) / (stat.maxVal - stat.minVal)) * 100)
              : 0;
            const lvl = stat.levels.find((l) => val >= l.minVal && val <= l.maxVal);
            const iconCls = COLOR_MAP[stat.color] ?? "text-gray-400";
            return (
              <div key={stat.id}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-sm ${iconCls}`}>{ICON_MAP[stat.icon] ?? "●"}</span>
                    <span className="text-xs text-t1 font-medium">{stat.name}</span>
                    {lvl && <span className="text-xs text-t2">({lvl.name})</span>}
                  </div>
                  <span className="text-xs font-mono text-t1">{val}{stat.unit ?? ""}</span>
                </div>
                <div className="h-1.5 bg-bg3 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${iconCls.replace("text-", "bg-")}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// 엔딩 모달
function EndingModal({
  ending,
  onClose,
}: {
  ending: EndingDef;
  onClose: () => void;
}) {
  const GRADE_COLORS: Record<string, string> = {
    N: "text-gray-300 border-gray-500",
    R: "text-blue-300 border-blue-500",
    SR: "text-purple-300 border-purple-500",
    SSR: "text-yellow-300 border-yellow-500",
  };
  const cls = GRADE_COLORS[ending.grade] ?? "text-gray-300 border-gray-500";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="relative bg-bg border border-bg3 rounded-2xl p-8 max-w-md w-full mx-4 flex flex-col items-center gap-4 text-center">
        {/* 등급 뱃지 */}
        <div className={`px-3 py-1 border rounded-full text-xs font-bold ${cls}`}>
          {ending.grade} 엔딩
        </div>

        {ending.image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ending.image} alt={ending.name} className="w-32 h-48 object-cover rounded-xl" />
        )}

        <h2 className="text-xl font-bold text-t1">{ending.name}</h2>

        {ending.epilogue && (
          <p className="text-sm text-t2 leading-relaxed whitespace-pre-wrap">{ending.epilogue}</p>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-2 px-8 py-2.5 bg-red hover:bg-red/80 text-white text-sm font-medium rounded-xl transition-colors"
        >
          확인
        </button>
      </div>
    </div>
  );
}

// 플레이 가이드 패널 (접이식)
function PlayGuidePanel({ guide }: { guide: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="mx-4 mt-2 border border-bg3 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-bg2 hover:bg-bg3 transition-colors"
      >
        <div className="flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-t2" aria-hidden="true">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <span className="text-xs font-medium text-t2">플레이 가이드</span>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-t2" aria-hidden="true">
          {open ? <polyline points="18 15 12 9 6 15" /> : <polyline points="6 9 12 15 18 9" />}
        </svg>
      </button>
      {open && (
        <div className="px-4 py-3 bg-bg2/50 text-xs text-t2 leading-relaxed whitespace-pre-wrap">
          {guide}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 메인 페이지
// ─────────────────────────────────────────────

export default function StoryPlayPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const storyId = params.id;
  const chapterId = searchParams.get("chapter");
  const branchId = searchParams.get("branch") ?? undefined;
  const sessionIdParam = searchParams.get("session") ?? null;

  // ── 데이터 상태 ──
  const [story, setStory] = useState<StoryDetail | null>(null);
  const [chapter, setChapter] = useState<ChapterDetail | null>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [statDefs, setStatDefs] = useState<StatDef[]>([]);
  const [endingDefs, setEndingDefs] = useState<EndingDef[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── 플레이어 설정 ──
  const [playerSetup, setPlayerSetup] = useState<PlayerSetup | null>(null);
  const [showStartModal, setShowStartModal] = useState(false);

  // ── 캐릭터 STATUS (무협 기본) ──
  const [charStatus, setCharStatus] = useState<CharacterStatus>(DEFAULT_STATUS);
  const [statusPanelOpen, setStatusPanelOpen] = useState(false);
  const [turnCount, setTurnCount] = useState(0);

  // ── 커스텀 스탯 ──
  const [customStats, setCustomStats] = useState<Record<string, number>>({});
  const [customStatPanelOpen, setCustomStatPanelOpen] = useState(false);

  // ── 엔딩 모달 ──
  const [triggeredEnding, setTriggeredEnding] = useState<EndingDef | null>(null);

  // ── 프롤로그 표시 ──
  const [prologueRead, setPrologueRead] = useState(false);

  // ── 채팅 ──
  const [playMessages, setPlayMessages] = useState<PlayMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [currentChoices, setCurrentChoices] = useState<string[]>([]);

  // ── DB 플레이 세션 ──
  const [playSessionId, setPlaySessionId] = useState<string | null>(null);

  // ── 재생성 ──
  const [lastUserMessage, setLastUserMessage] = useState("");

  // ── 모델 선택 ──
  const [selectedModel, setSelectedModel] = useState<ClaudeModelId>(DEFAULT_MODEL);
  const [prefetchId, setPrefetchId] = useState<string | null>(null);
  const [prefetchEnabled, setPrefetchEnabled] = useState<boolean>(() => {
    try { return localStorage.getItem("saga-play-prefetch") !== "off"; } catch { return true; }
  });

  // ── 첫 턴 자동 시작 ──
  const [pendingInitialTurn, setPendingInitialTurn] = useState(false);
  const pendingSetupRef = useRef<PlayerSetup | null>(null);

  // ── 자동재생 ──
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [autoPlayRemaining, setAutoPlayRemaining] = useState(0);
  const isAutoPlayingRef = useRef(false);
  const autoPlayRemainingRef = useRef(0);
  const currentChoicesRef = useRef<string[]>([]);
  const handleSendRef = useRef<(content: string) => Promise<void>>(async () => {});

  useEffect(() => { isAutoPlayingRef.current = isAutoPlaying; }, [isAutoPlaying]);
  useEffect(() => { autoPlayRemainingRef.current = autoPlayRemaining; }, [autoPlayRemaining]);
  useEffect(() => { currentChoicesRef.current = currentChoices; }, [currentChoices]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── localStorage 불러오기 ──
  useEffect(() => {
    if (!storyId) return;
    try {
      const savedModel = localStorage.getItem(`saga-play-model-${storyId}`);
      if (savedModel) setSelectedModel(savedModel as ClaudeModelId);
      const savedSetup = localStorage.getItem(lsSetupKey(storyId, branchId));
      if (savedSetup) setPlayerSetup(JSON.parse(savedSetup) as PlayerSetup);
      else if (!branchId) setShowStartModal(true);
      const savedStatus = localStorage.getItem(lsStatusKey(storyId, branchId));
      if (savedStatus) setCharStatus(JSON.parse(savedStatus) as CharacterStatus);
      const savedCustomStats = localStorage.getItem(lsCustomStatsKey(storyId, branchId));
      if (savedCustomStats) setCustomStats(JSON.parse(savedCustomStats) as Record<string, number>);
    } catch {
      if (!branchId) setShowStartModal(true);
    }
  }, [storyId, branchId]);

  // ── DB 세션 복원 ──
  useEffect(() => {
    if (!sessionIdParam) return;
    setPlaySessionId(sessionIdParam);
    fetch(`/api/play-sessions/${sessionIdParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: {
        session: {
          playerSetup: string;
          charStatus: string;
          turnCount: number;
          messages: Array<{ id: string; role: string; content: string; choices?: string; createdAt: string }>;
        };
      } | null) => {
        if (!data?.session) return;
        const s = data.session;
        try {
          if (s.playerSetup) setPlayerSetup(JSON.parse(s.playerSetup) as PlayerSetup);
          if (s.charStatus) setCharStatus(JSON.parse(s.charStatus) as CharacterStatus);
          if (typeof s.turnCount === "number") setTurnCount(s.turnCount);
          if (s.messages?.length) {
            const msgs: PlayMessage[] = s.messages.map((m) => ({
              id: m.id,
              role: m.role as "USER" | "ASSISTANT",
              content: m.content,
              choices: m.choices ? (JSON.parse(m.choices) as string[]) : undefined,
              createdAt: m.createdAt,
            }));
            setPlayMessages(msgs);
            const last = [...msgs].reverse().find((m) => m.role === "ASSISTANT");
            if (last?.choices?.length) setCurrentChoices(last.choices);
          }
        } catch { /* ignore */ }
      })
      .catch(() => {});
  }, [sessionIdParam]);

  // ── 메시지 복원 ──
  useEffect(() => {
    if (!storyId || !chapterId) return;
    try {
      const saved = localStorage.getItem(lsMsgKey(storyId, chapterId, branchId));
      if (saved) {
        const msgs = JSON.parse(saved) as PlayMessage[];
        setPlayMessages(msgs);
        const last = [...msgs].reverse().find((m) => m.role === "ASSISTANT");
        if (last?.choices?.length) setCurrentChoices(last.choices);
      }
    } catch { /* ignore */ }
  }, [storyId, chapterId, branchId]);

  // ── 스토리 + 챕터 + 스탯/엔딩 로딩 ──
  useEffect(() => {
    if (!chapterId) return;
    let cancelled = false;
    async function load() {
      try {
        const [storyRes, chapterRes, chaptersRes, statsRes, endingsRes] = await Promise.all([
          fetch(`/api/stories/${storyId}`),
          fetch(`/api/stories/${storyId}/chapters/${chapterId}`),
          fetch(`/api/stories/${storyId}/chapters`),
          fetch(`/api/stories/${storyId}/stats`),
          fetch(`/api/stories/${storyId}/endings`),
        ]);
        if (cancelled) return;
        if (!storyRes.ok || !chapterRes.ok) {
          setLoadError("스토리 또는 챕터를 불러올 수 없습니다.");
          return;
        }
        const storyData = (await storyRes.json()) as StoryDetail;
        const chapterData = (await chapterRes.json()) as ChapterDetail;
        const chaptersData = chaptersRes.ok ? (await chaptersRes.json()) as { chapters: ChapterSummary[] } : { chapters: [] };
        const statsData = statsRes.ok ? (await statsRes.json()) as { statDefs: StatDef[] } : { statDefs: [] };
        const endingsData = endingsRes.ok ? (await endingsRes.json()) as { endings: EndingDef[] } : { endings: [] };
        if (cancelled) return;
        setStory(storyData);
        setChapter(chapterData);
        setChapters(chaptersData.chapters);
        setStatDefs(statsData.statDefs);
        setEndingDefs(endingsData.endings);
      } catch (err) {
        if (!cancelled) {
          console.error("[StoryPlayPage]", err);
          setLoadError("네트워크 오류가 발생했습니다.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }
    setIsLoading(true);
    setLoadError(null);
    load();
    return () => { cancelled = true; };
  }, [storyId, chapterId]);

  // ── 첫 챕터 리다이렉트 ──
  useEffect(() => {
    if (!chapterId && chapters.length > 0) {
      try {
        const saved = localStorage.getItem(lsProgressKey(storyId));
        if (saved) {
          const progress = JSON.parse(saved) as PlayProgress;
          if (progress.lastChapterId) {
            router.replace(`/story/${storyId}/play?chapter=${progress.lastChapterId}`);
            return;
          }
        }
      } catch { /* ignore */ }
      router.replace(`/story/${storyId}/play?chapter=${chapters[0].id}`);
    }
  }, [chapterId, chapters, storyId, router]);

  // ── 자동 스크롤 ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [playMessages, isSending]);

  // ── 첫 턴 자동 호출 ──
  useEffect(() => {
    if (!pendingInitialTurn || isSending || !chapter || !pendingSetupRef.current) return;
    setPendingInitialTurn(false);
    const setup = pendingSetupRef.current;
    const initialStatus: CharacterStatus = { ...DEFAULT_STATUS, name: setup.name, gender: setup.gender, faction: setup.faction };
    setIsSending(true);
    fetch(`/api/stories/${storyId}/play-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userMessage: "이야기를 시작합니다.",
        chapterTitle: chapter.title, chapterContent: chapter.content,
        playerSetup: setup, currentStatus: initialStatus, turnCount: 0, isInitialTurn: true,
      }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { rawReply: string }) => {
        const { story: storyContent, rawStatus, choices } = parseAIResponse(data.rawReply);
        const newStatus = parseStatusUpdate(rawStatus, initialStatus);
        setCharStatus(newStatus);
        try { localStorage.setItem(lsStatusKey(storyId, branchId), JSON.stringify(newStatus)); } catch { /* ignore */ }
        const initMsg: PlayMessage = { id: `ai-init-${Date.now()}`, role: "ASSISTANT", content: storyContent, choices, createdAt: new Date().toISOString() };
        setPlayMessages([initMsg]);
        try { localStorage.setItem(lsMsgKey(storyId, chapterId ?? "", branchId), JSON.stringify([initMsg])); } catch { /* ignore */ }
        if (choices.length > 0) { setCurrentChoices(choices); setStatusPanelOpen(true); }
      })
      .catch((err) => console.error("[initialTurn]", err))
      .finally(() => setIsSending(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInitialTurn, chapter, isSending]);

  // ── 자동재생 트리거 ──
  useEffect(() => {
    if (!isAutoPlaying || isSending || autoPlayRemaining <= 0) return;
    const timer = setTimeout(() => {
      if (!isAutoPlayingRef.current || autoPlayRemainingRef.current <= 0) return;
      const choices = currentChoicesRef.current;
      const action = choices.length > 0 ? choices[0] : "이야기를 계속 진행한다.";
      handleSendRef.current(action);
    }, 800);
    return () => clearTimeout(timer);
  }, [isAutoPlaying, isSending, autoPlayRemaining]);

  function saveProgress(currentChapterId: string) {
    try {
      const saved = localStorage.getItem(lsProgressKey(storyId));
      const progress: PlayProgress = saved
        ? (JSON.parse(saved) as PlayProgress)
        : { lastChapterId: currentChapterId, completedChapterIds: [] };
      progress.lastChapterId = currentChapterId;
      localStorage.setItem(lsProgressKey(storyId), JSON.stringify(progress));
    } catch { /* ignore */ }
  }

  function handleModelChange(model: ClaudeModelId) {
    setSelectedModel(model);
    try { localStorage.setItem(`saga-play-model-${storyId}`, model); } catch { /* ignore */ }
  }

  function handleSetupConfirm(setup: PlayerSetup) {
    setPlayerSetup(setup);
    setShowStartModal(false);
    try { localStorage.setItem(lsSetupKey(storyId, branchId), JSON.stringify(setup)); } catch { /* ignore */ }
    const initialStatus: CharacterStatus = { ...DEFAULT_STATUS, name: setup.name, gender: setup.gender, faction: setup.faction };
    setCharStatus(initialStatus);
    try { localStorage.setItem(lsStatusKey(storyId, branchId), JSON.stringify(initialStatus)); } catch { /* ignore */ }
    if (playMessages.length === 0) { pendingSetupRef.current = setup; setPendingInitialTurn(true); }
    if (chapterId) {
      fetch("/api/play-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storyId, chapterId, branchId: branchId ?? null, playerSetup: setup, charStatus: initialStatus }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((data: { id: string } | null) => {
          if (data?.id) {
            setPlaySessionId(data.id);
            const url = new URL(window.location.href);
            url.searchParams.set("session", data.id);
            window.history.replaceState({}, "", url.toString());
            swrMutate("/api/play-sessions?limit=10");
          }
        })
        .catch(() => {});
    }
  }

  // ── 메시지 전송 ── (SSE 스트리밍)
  const handleSend = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isSending) return;

      setLastUserMessage(trimmed);
      setPrefetchId(null);

      const tempId = `temp-user-${Date.now()}`;
      const streamingId = `streaming-ai-${Date.now()}`;
      const tempUserMsg: PlayMessage = { id: tempId, role: "USER", content: trimmed, createdAt: new Date().toISOString() };
      setPlayMessages((prev) => [...prev, tempUserMsg]);
      setIsSending(true);
      setInputValue("");
      setCurrentChoices([]);

      try {
        const res = await fetch(`/api/stories/${storyId}/play-stream`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userMessage: trimmed,
            chapterTitle: chapter?.title ?? "",
            chapterContent: chapter?.content ?? "",
            playerSetup,
            currentStatus: { ...charStatus, customStats },
            turnCount: turnCount + 1,
            model: selectedModel,
            prefetchId: prefetchId ?? undefined,
            prefetchedChoice: prefetchId ? trimmed : undefined,
          }),
        });

        if (!res.ok || !res.body) {
          setPlayMessages((prev) => prev.filter((m) => m.id !== tempId));
          if (res.status === 401) router.push("/login");
          return;
        }

        setPlayMessages((prev) => [
          ...prev,
          { id: streamingId, role: "ASSISTANT", content: "", createdAt: new Date().toISOString() },
        ]);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let storyContent = "";
        let rawStatus = "";
        let choices: string[] = [];
        let updatedCustomStats: Record<string, number> = customStats;
        let endingId: string | undefined;
        let matchedMediaUrl: string | undefined;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const evt = JSON.parse(line.slice(6)) as {
                type: string;
                text?: string;
                storyContent?: string;
                rawStatus?: string;
                choices?: string[];
                customStats?: Record<string, number>;
                endingId?: string;
                mediaUrl?: string;
                message?: string;
              };
              if (evt.type === "chunk" && evt.text) {
                setPlayMessages((prev) =>
                  prev.map((m) => m.id === streamingId ? { ...m, content: m.content + evt.text! } : m)
                );
              } else if (evt.type === "done") {
                storyContent = evt.storyContent ?? "";
                rawStatus = evt.rawStatus ?? "";
                choices = evt.choices ?? [];
                if (evt.customStats) updatedCustomStats = evt.customStats;
                if (evt.endingId) endingId = evt.endingId;
                if (evt.mediaUrl) matchedMediaUrl = evt.mediaUrl;
              } else if (evt.type === "error") {
                setPlayMessages((prev) => prev.filter((m) => m.id !== streamingId));
                return;
              }
            } catch { /* 무시 */ }
          }
        }

        // STATUS 업데이트
        const newStatus = parseStatusUpdate(rawStatus, charStatus);
        setCharStatus(newStatus);
        try { localStorage.setItem(lsStatusKey(storyId, branchId), JSON.stringify(newStatus)); } catch { /* ignore */ }

        // 커스텀 스탯 업데이트
        setCustomStats(updatedCustomStats);
        try { localStorage.setItem(lsCustomStatsKey(storyId, branchId), JSON.stringify(updatedCustomStats)); } catch { /* ignore */ }

        const newTurn = turnCount + 1;
        setTurnCount(newTurn);

        const assistantMsg: PlayMessage = {
          id: `ai-${Date.now()}`, role: "ASSISTANT", content: storyContent, choices,
          createdAt: new Date().toISOString(),
          mediaUrl: matchedMediaUrl,
        };

        setPlayMessages((prev) => {
          const updated = [
            ...prev.filter((m) => m.id !== tempId && m.id !== streamingId),
            { ...tempUserMsg, id: `user-${Date.now()}` },
            assistantMsg,
          ];
          try { localStorage.setItem(lsMsgKey(storyId, chapterId ?? "", branchId), JSON.stringify(updated)); } catch { /* ignore */ }
          return updated;
        });

        if (choices.length > 0) {
          setCurrentChoices(choices);
          // 커스텀 스탯이 있으면 커스텀 패널, 없으면 기본 패널 열기
          if (statDefs.length > 0) setCustomStatPanelOpen(true);
          else setStatusPanelOpen(true);

          // 선택지 프리페치
          if (prefetchEnabled) {
            fetch(`/api/stories/${storyId}/play-prefetch`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                choices, chapterTitle: chapter?.title ?? "", chapterContent: chapter?.content ?? "",
                playerSetup, currentStatus: { ...newStatus, customStats: updatedCustomStats },
                turnCount: newTurn, model: selectedModel,
              }),
            })
              .then((r) => (r.ok ? r.json() : null))
              .then((data: { prefetchId: string } | null) => { if (data?.prefetchId) setPrefetchId(data.prefetchId); })
              .catch(() => {});
          }
        }

        // 엔딩 트리거
        if (endingId) {
          const ending = endingDefs.find((e) => e.id === endingId);
          if (ending) setTriggeredEnding(ending);
        }

        saveProgress(chapterId ?? "");

        const sessionIdToUpdate = playSessionId;
        if (sessionIdToUpdate) {
          fetch(`/api/play-sessions/${sessionIdToUpdate}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              charStatus: newStatus, turnCount: newTurn, lastMessage: storyContent.slice(0, 100),
              messages: [{ role: "USER", content: trimmed }, { role: "ASSISTANT", content: storyContent, choices }],
            }),
          })
            .then(() => swrMutate("/api/play-sessions?limit=10"))
            .catch(() => {});
        } else if (chapterId) {
          fetch("/api/play-sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ storyId, chapterId, branchId: branchId ?? null, playerSetup: playerSetup ?? {}, charStatus: newStatus }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((created: { id: string } | null) => {
              if (created?.id) {
                setPlaySessionId(created.id);
                const url = new URL(window.location.href);
                url.searchParams.set("session", created.id);
                window.history.replaceState({}, "", url.toString());
                fetch(`/api/play-sessions/${created.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    turnCount: newTurn, lastMessage: storyContent.slice(0, 100),
                    messages: [{ role: "USER", content: trimmed }, { role: "ASSISTANT", content: storyContent, choices }],
                  }),
                })
                  .then(() => swrMutate("/api/play-sessions?limit=10"))
                  .catch(() => {});
              }
            })
            .catch(() => {});
        }

        if (isAutoPlayingRef.current) {
          const next = autoPlayRemainingRef.current - 1;
          autoPlayRemainingRef.current = next;
          setAutoPlayRemaining(next);
          if (next <= 0) { isAutoPlayingRef.current = false; setIsAutoPlaying(false); }
        }
      } catch (err) {
        console.error("[StoryPlayPage] 스트리밍 오류:", err);
        setPlayMessages((prev) => prev.filter((m) => m.id !== tempId && m.id !== streamingId));
      } finally {
        setIsSending(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSending, chapter, storyId, chapterId, branchId, playerSetup, charStatus, customStats, turnCount, router, playSessionId, selectedModel, prefetchId, statDefs, endingDefs]
  );

  useEffect(() => { handleSendRef.current = handleSend; }, [handleSend]);

  function handleRegenerate() {
    if (!lastUserMessage || isSending) return;
    setPlayMessages((prev) => {
      const msgs = [...prev];
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "ASSISTANT") { msgs.splice(i, 1); break; }
      }
      return msgs;
    });
    setCurrentChoices([]);
    setTimeout(() => handleSend(lastUserMessage), 100);
  }

  function handleBranch() {
    if (!chapterId || !playerSetup) return;
    const newBranchId = `${Date.now()}`;
    try {
      localStorage.setItem(lsSetupKey(storyId, newBranchId), JSON.stringify(playerSetup));
      localStorage.setItem(lsStatusKey(storyId, newBranchId), JSON.stringify(charStatus));
      localStorage.setItem(lsMsgKey(storyId, chapterId, newBranchId), JSON.stringify(playMessages));
    } catch { /* ignore */ }
    router.push(`/story/${storyId}/play?chapter=${chapterId}&branch=${newBranchId}`);
  }

  function handleAutoPlayToggle() {
    if (isAutoPlaying) {
      isAutoPlayingRef.current = false; autoPlayRemainingRef.current = 0;
      setIsAutoPlaying(false); setAutoPlayRemaining(0);
    } else {
      isAutoPlayingRef.current = true; autoPlayRemainingRef.current = 3;
      setIsAutoPlaying(true); setAutoPlayRemaining(3);
    }
  }

  function adjustHeight() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  function navigateChapter(direction: "prev" | "next") {
    if (!chapter || chapters.length === 0) return;
    const idx = chapters.findIndex((c) => c.id === chapter.id);
    if (idx === -1) return;
    const targetIdx = direction === "prev" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= chapters.length) return;
    isAutoPlayingRef.current = false; setIsAutoPlaying(false); setAutoPlayRemaining(0);
    const url = branchId
      ? `/story/${storyId}/play?chapter=${chapters[targetIdx].id}&branch=${branchId}`
      : `/story/${storyId}/play?chapter=${chapters[targetIdx].id}`;
    router.push(url);
  }

  const currentChapterIdx = chapter ? chapters.findIndex((c) => c.id === chapter.id) : -1;
  const hasPrev = currentChapterIdx > 0;
  const hasNext = currentChapterIdx >= 0 && currentChapterIdx < chapters.length - 1;
  const lastMsg = playMessages[playMessages.length - 1];
  const canRegenerate = lastMsg?.role === "ASSISTANT" && !!lastUserMessage && !isSending;

  // ─────────────────────────────────────────────
  // 렌더링
  // ─────────────────────────────────────────────

  if (isLoading) return <LoadingSkeleton />;
  if (loadError) return <ErrorScreen message={loadError} />;
  if (!chapter || !story) return <ErrorScreen message="챕터를 불러올 수 없습니다." />;

  const hasCustomStats = statDefs.length > 0;
  const mainMarginRight = (statusPanelOpen || customStatPanelOpen) ? "256px" : "0";

  return (
    <>
      {/* 시작설정 모달 */}
      {showStartModal && (
        <StartSettingsModal storyTitle={story.title} genre={story.genre ?? []} onConfirm={handleSetupConfirm} />
      )}

      {/* 엔딩 모달 */}
      {triggeredEnding && (
        <EndingModal ending={triggeredEnding} onClose={() => setTriggeredEnding(null)} />
      )}

      {/* 커스텀 스탯 패널 (있으면 우선 표시) */}
      {hasCustomStats ? (
        <CustomStatPanel
          statDefs={statDefs}
          statValues={customStats}
          isOpen={customStatPanelOpen}
          onToggle={() => setCustomStatPanelOpen((v) => !v)}
        />
      ) : (
        <CharacterStatusPanel
          status={charStatus}
          turnCount={turnCount}
          isOpen={statusPanelOpen}
          onToggle={() => setStatusPanelOpen((v) => !v)}
        />
      )}

      {/* 메인 레이아웃 */}
      <div className="fixed top-14 bottom-0 md:left-60 right-0 flex justify-center bg-bg z-10 overflow-hidden">
        <div
          className="w-full flex flex-col overflow-hidden transition-all duration-300"
          style={{ maxWidth: "900px", marginRight: mainMarginRight }}
        >
          {/* ── 헤더 ── */}
          <header className="h-14 bg-bg2 border-b border-bg3 flex items-center px-4 gap-3 shrink-0">
            <button type="button" onClick={() => router.push(`/stories/${storyId}`)} aria-label="뒤로"
              className="w-8 h-8 flex items-center justify-center text-t2 hover:text-t1 transition-colors rounded-lg hover:bg-bg3 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-t1 font-semibold text-sm truncate">
                {story.title}
                <span className="text-t2 font-normal"> — {chapter.orderIndex}화: {chapter.title}</span>
              </p>
            </div>
            {branchId && (
              <div className="shrink-0 px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/40">
                <span className="text-xs text-purple-300">분기</span>
              </div>
            )}
            {isAutoPlaying && (
              <div className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-500/20 border border-green-500/40">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-green-300">자동 {autoPlayRemaining}턴</span>
              </div>
            )}
            {playerSetup && (
              <div className="shrink-0 px-2.5 py-1 rounded-lg bg-bg3 border border-bg3">
                <span className="text-xs text-t2">{playerSetup.faction}</span>
              </div>
            )}
            <ModelDropdown value={selectedModel} onChange={handleModelChange} />
            <button type="button" onClick={() => setShowStartModal(true)} aria-label="시작설정" title="시작설정 다시 하기"
              className="w-8 h-8 flex items-center justify-center text-t2 hover:text-t1 transition-colors rounded-lg hover:bg-bg3 shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="3" /><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
              </svg>
            </button>
          </header>

          {/* 플레이 가이드 패널 */}
          {story.playGuide && <PlayGuidePanel guide={story.playGuide} />}

          {/* ── 본문 + 대화 (스크롤) ── */}
          <div className="flex-1 overflow-y-auto scrollbar-hide">
            <article className="px-6 py-8">
              <h2 className="text-t1 font-bold text-lg mb-6">{chapter.orderIndex}화. {chapter.title}</h2>
              <div className="text-t2 leading-8 text-sm whitespace-pre-wrap">
                {parseStoryMarkdown(chapter.content)}
              </div>
            </article>

            {/* 프롤로그 표시 */}
            {story.prologue && !prologueRead && playMessages.length === 0 && (
              <div className="mx-6 mb-4 bg-bg2/80 border border-bg3 rounded-2xl p-5 flex flex-col gap-3">
                <p className="text-xs font-semibold text-t2 uppercase tracking-wider">Prologue</p>
                <div className="text-sm text-t1 leading-relaxed whitespace-pre-wrap">
                  {parseStoryMarkdown(story.prologue)}
                </div>
                <button type="button" onClick={() => setPrologueRead(true)}
                  className="self-end text-xs px-4 py-1.5 bg-red/20 hover:bg-red/30 text-red rounded-lg transition-colors">
                  계속하기 →
                </button>
              </div>
            )}

            <div className="border-t border-bg3 mx-6" />

            <div className="px-4 py-4 space-y-4">
              {playMessages.length === 0 && !isSending && !showStartModal && (
                <div className="text-center py-6">
                  <p className="text-xs text-t2 mb-2">이야기에 참여해보세요.</p>
                  {playerSetup && (
                    <p className="text-xs text-t2/50">{playerSetup.name} · {playerSetup.faction} · {playerSetup.gender}</p>
                  )}
                </div>
              )}

              {playMessages.map((msg, msgIdx) =>
                msg.role === "USER" ? (
                  <div key={msg.id} className="flex justify-end">
                    <div className="bg-red/20 text-t1 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[75%] text-sm leading-relaxed">
                      {msg.content.split("\n").map((line, i) => (<span key={i}>{i > 0 && <br />}{line}</span>))}
                    </div>
                  </div>
                ) : (
                  <div key={msg.id} className="flex flex-col items-start gap-1">
                    {/* Phase 5: 상황 이미지 인라인 표시 */}
                    {msg.mediaUrl && (
                      <div className="max-w-[85%] rounded-2xl overflow-hidden mb-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={msg.mediaUrl}
                          alt="상황 이미지"
                          className="w-full object-cover max-h-64 rounded-2xl"
                          loading="lazy"
                        />
                      </div>
                    )}
                    <div className="bg-bg2 text-t1 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] text-sm leading-relaxed">
                      {parseStoryMarkdown(msg.content)}
                    </div>
                    {msgIdx === playMessages.length - 1 && currentChoices.length > 0 && !isSending && (
                      <div className="w-full flex flex-col gap-1 mt-1" style={{ maxWidth: "85%" }}>
                        {currentChoices.map((choice, ci) => (
                          <button key={ci} type="button" disabled={isSending} onClick={() => handleSend(choice)}
                            className="text-left px-3 py-2 bg-bg3/70 hover:bg-bg3 text-t1 text-xs rounded-xl transition-colors border border-bg3 hover:border-t2/20 disabled:opacity-40 leading-snug">
                            {choice}
                          </button>
                        ))}
                      </div>
                    )}
                    {msgIdx === playMessages.length - 1 && canRegenerate && (
                      <button type="button" onClick={handleRegenerate} title="다시 생성"
                        className="flex items-center gap-1 px-2 py-1 text-xs text-t2 hover:text-t1 rounded-lg hover:bg-bg3 transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3.92" />
                        </svg>
                        다시 생성
                      </button>
                    )}
                  </div>
                )
              )}

              {isSending && (
                <div className="flex justify-start">
                  <div className="bg-bg2 rounded-2xl rounded-tl-sm px-4"><DotsTyping /></div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </div>

          {/* ── 툴바 + 입력 영역 ── */}
          <div className="border-t border-bg3 bg-bg shrink-0">
            <div className="px-4 pt-2 pb-0 flex items-center gap-2 w-full">
              <button type="button" onClick={handleBranch} disabled={playMessages.length === 0 || isSending} title="현재 시점에서 분기 생성"
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-t2 hover:text-t1 rounded-lg border border-bg3 hover:border-t2/30 hover:bg-bg3 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="6" y1="3" x2="6" y2="15" /><circle cx="18" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M18 9a9 9 0 0 1-9 9" />
                </svg>
                분기
              </button>
              <button type="button" onClick={handleAutoPlayToggle} disabled={isSending && !isAutoPlaying} title={isAutoPlaying ? "자동재생 중단" : "자동재생 (3턴)"}
                className={["flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-colors",
                  isAutoPlaying ? "text-green-300 border-green-500/40 bg-green-500/10 hover:bg-green-500/20" : "text-t2 hover:text-t1 border-bg3 hover:border-t2/30 hover:bg-bg3",
                  "disabled:opacity-30 disabled:cursor-not-allowed"].join(" ")}>
                {isAutoPlaying ? (
                  <><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>중단</>
                ) : (
                  <><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21 5 3" /></svg>자동재생</>
                )}
              </button>
              <button type="button"
                onClick={() => {
                  const next = !prefetchEnabled;
                  setPrefetchEnabled(next);
                  try { localStorage.setItem("saga-play-prefetch", next ? "on" : "off"); } catch { /**/ }
                  if (!next) setPrefetchId(null);
                }}
                title={prefetchEnabled ? "프리페치 ON — 클릭하여 끄기" : "프리페치 OFF — 클릭하여 켜기"}
                className={["flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-colors",
                  prefetchEnabled ? "text-yellow-300 border-yellow-500/40 bg-yellow-500/10 hover:bg-yellow-500/20" : "text-t2 border-bg3 hover:border-t2/30 hover:bg-bg3 opacity-50"].join(" ")}>
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>
                {prefetchEnabled ? "프리페치 ON" : "프리페치 OFF"}
              </button>
            </div>

            <div className="px-4 pt-2 pb-safe-or-4 w-full">
              <div className="flex items-end gap-2">
                <textarea ref={textareaRef} value={inputValue}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => { setInputValue(e.target.value); adjustHeight(); }}
                  onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(inputValue); }
                  }}
                  disabled={isSending} rows={1} maxLength={500}
                  placeholder={isSending ? "생성 중..." : "행동이나 대화를 입력하세요..."}
                  className="flex-1 bg-bg2 border border-bg3 focus:border-red/50 rounded-xl px-4 py-2.5 text-sm text-t1 placeholder:text-t2 outline-none resize-none transition-colors scrollbar-hide"
                  style={{ minHeight: "40px", maxHeight: "120px" }} />
                <button type="button" onClick={() => handleSend(inputValue)}
                  disabled={isSending || inputValue.trim().length === 0} aria-label="전송"
                  className="shrink-0 w-10 h-10 flex items-center justify-center bg-red hover:bg-red/80 disabled:bg-red/30 text-white rounded-xl transition-colors">
                  {isSending ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between mt-2">
                <button type="button" onClick={() => navigateChapter("prev")} disabled={!hasPrev}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-t2 hover:text-t1 rounded-lg hover:bg-bg3 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="15 18 9 12 15 6" /></svg>
                  이전 화
                </button>
                <span className="text-xs text-t2">{currentChapterIdx + 1} / {chapters.length}</span>
                <button type="button" onClick={() => navigateChapter("next")} disabled={!hasNext}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-t2 hover:text-t1 rounded-lg hover:bg-bg3 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                  다음 화
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}