"use client";

// 스토리 플레이 페이지
// crack.wrtn.ai 참고: 시작설정 + STATUS 패널 + 추천답변
// 고도화: 진행 저장 + 재생성 + 분기 + 자동재생
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
};

type PlayMessage = {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  choices?: string[];
  createdAt: string;
};

type PlayProgress = {
  lastChapterId: string;
  completedChapterIds: string[];
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
      if (before)
        lineNodes.push(
          <span key={`l${lineIdx}-p-${kc++}`}>{before}</span>
        );

      const token = match[0];
      if (token.startsWith("**") && token.endsWith("**")) {
        lineNodes.push(
          <span key={`l${lineIdx}-b-${kc++}`} className="text-t2">
            {token.slice(2, -2)}
          </span>
        );
      } else if (token.startsWith('"') && token.endsWith('"')) {
        lineNodes.push(
          <span
            key={`l${lineIdx}-q-${kc++}`}
            className="text-t1 font-medium"
          >
            {token}
          </span>
        );
      } else if (token.startsWith("*") && token.endsWith("*")) {
        lineNodes.push(
          <em
            key={`l${lineIdx}-i-${kc++}`}
            className="opacity-70"
            style={{ fontStyle: "italic" }}
          >
            {token.slice(1, -1)}
          </em>
        );
      } else {
        lineNodes.push(
          <span key={`l${lineIdx}-r-${kc++}`}>{token}</span>
        );
      }
      lastIndex = match.index + token.length;
    }

    const tail = line.slice(lastIndex);
    if (tail)
      lineNodes.push(<span key={`l${lineIdx}-tail`}>{tail}</span>);
    nodes.push(<span key={`line-${lineIdx}`}>{lineNodes}</span>);
  });

  return nodes;
}

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
          <div
            key={i}
            className="h-4 bg-bg3 rounded animate-pulse"
            style={{ width: `${70 + i * 7}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function ErrorScreen({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen bg-bg gap-4">
      <p className="text-t2 text-sm">{message}</p>
      <Link href="/" className="text-red text-sm hover:underline">
        홈으로 돌아가기
      </Link>
    </div>
  );
}

function DotsTyping() {
  return (
    <div className="flex items-center gap-1 py-2">
      {[0, 160, 320].map((delay) => (
        <span
          key={delay}
          className="w-1.5 h-1.5 rounded-full bg-t2 animate-bounce"
          style={{
            animationDelay: `${delay}ms`,
            animationDuration: "800ms",
          }}
        />
      ))}
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
  // 분기 ID (분기 세션인 경우 URL에 포함)
  const branchId = searchParams.get("branch") ?? undefined;
  // DB 세션 ID (URL에 포함된 경우 복원)
  const sessionIdParam = searchParams.get("session") ?? null;

  // ── 데이터 상태 ──
  const [story, setStory] = useState<StoryDetail | null>(null);
  const [chapter, setChapter] = useState<ChapterDetail | null>(null);
  const [chapters, setChapters] = useState<ChapterSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // ── 플레이어 설정 ──
  const [playerSetup, setPlayerSetup] = useState<PlayerSetup | null>(null);
  const [showStartModal, setShowStartModal] = useState(false);

  // ── 캐릭터 STATUS ──
  const [charStatus, setCharStatus] = useState<CharacterStatus>(DEFAULT_STATUS);
  const [statusPanelOpen, setStatusPanelOpen] = useState(false);
  const [turnCount, setTurnCount] = useState(0);

  // ── 채팅 ──
  const [playMessages, setPlayMessages] = useState<PlayMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [currentChoices, setCurrentChoices] = useState<string[]>([]);

  // ── DB 플레이 세션 ──
  const [playSessionId, setPlaySessionId] = useState<string | null>(null);

  // ── 재생성 ──
  const [lastUserMessage, setLastUserMessage] = useState("");

  // ── 첫 턴 자동 시작 ──
  const [pendingInitialTurn, setPendingInitialTurn] = useState(false);
  // 첫 턴용 setup ref (useEffect에서 stale closure 방지)
  const pendingSetupRef = useRef<PlayerSetup | null>(null);

  // ── 자동재생 ──
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);
  const [autoPlayRemaining, setAutoPlayRemaining] = useState(0);
  // 자동재생 ref (stale closure 방지)
  const isAutoPlayingRef = useRef(false);
  const autoPlayRemainingRef = useRef(0);
  const currentChoicesRef = useRef<string[]>([]);
  const handleSendRef = useRef<(content: string) => Promise<void>>(
    async () => {}
  );

  useEffect(() => {
    isAutoPlayingRef.current = isAutoPlaying;
  }, [isAutoPlaying]);
  useEffect(() => {
    autoPlayRemainingRef.current = autoPlayRemaining;
  }, [autoPlayRemaining]);
  useEffect(() => {
    currentChoicesRef.current = currentChoices;
  }, [currentChoices]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── localStorage 불러오기 ──
  useEffect(() => {
    if (!storyId) return;
    try {
      const savedSetup = localStorage.getItem(lsSetupKey(storyId, branchId));
      if (savedSetup) {
        setPlayerSetup(JSON.parse(savedSetup) as PlayerSetup);
      } else if (!branchId) {
        // 기본 세션: 설정이 없으면 모달 표시
        setShowStartModal(true);
      }
      const savedStatus = localStorage.getItem(
        lsStatusKey(storyId, branchId)
      );
      if (savedStatus)
        setCharStatus(JSON.parse(savedStatus) as CharacterStatus);
    } catch {
      if (!branchId) setShowStartModal(true);
    }
  }, [storyId, branchId]);

  // ── DB 세션 복원 (sessionIdParam이 있을 때 DB 우선) ──
  useEffect(() => {
    if (!sessionIdParam) return;
    setPlaySessionId(sessionIdParam);

    fetch(`/api/play-sessions/${sessionIdParam}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (
          data: {
            session: {
              playerSetup: string;
              charStatus: string;
              turnCount: number;
              messages: Array<{
                id: string;
                role: string;
                content: string;
                choices?: string;
                createdAt: string;
              }>;
            };
          } | null
        ) => {
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
          } catch {
            /* DB 복원 실패 시 무시 */
          }
        }
      )
      .catch(() => {});
  }, [sessionIdParam]);

  // ── 메시지 복원 (챕터 전환 / 분기 진입 시) ──
  useEffect(() => {
    if (!storyId || !chapterId) return;
    try {
      const saved = localStorage.getItem(
        lsMsgKey(storyId, chapterId, branchId)
      );
      if (saved) {
        const msgs = JSON.parse(saved) as PlayMessage[];
        setPlayMessages(msgs);
        // 마지막 assistant 메시지의 choices 복원
        const last = [...msgs].reverse().find((m) => m.role === "ASSISTANT");
        if (last?.choices?.length) setCurrentChoices(last.choices);
      }
    } catch {
      /* ignore */
    }
  }, [storyId, chapterId, branchId]);

  // ── 스토리 + 챕터 로딩 ──
  useEffect(() => {
    if (!chapterId) return;
    let cancelled = false;

    async function load() {
      try {
        const [storyRes, chapterRes, chaptersRes] = await Promise.all([
          fetch(`/api/stories/${storyId}`),
          fetch(`/api/stories/${storyId}/chapters/${chapterId}`),
          fetch(`/api/stories/${storyId}/chapters`),
        ]);
        if (cancelled) return;
        if (!storyRes.ok || !chapterRes.ok) {
          setLoadError("스토리 또는 챕터를 불러올 수 없습니다.");
          return;
        }
        const storyData = (await storyRes.json()) as StoryDetail;
        const chapterData = (await chapterRes.json()) as ChapterDetail;
        const chaptersData = chaptersRes.ok
          ? ((await chaptersRes.json()) as { chapters: ChapterSummary[] })
          : { chapters: [] };
        if (cancelled) return;
        setStory(storyData);
        setChapter(chapterData);
        setChapters(chaptersData.chapters);
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
    return () => {
      cancelled = true;
    };
  }, [storyId, chapterId]);

  // ── 첫 챕터 리다이렉트 ──
  useEffect(() => {
    if (!chapterId && chapters.length > 0) {
      // 진행 저장에서 마지막 챕터 복원
      try {
        const saved = localStorage.getItem(lsProgressKey(storyId));
        if (saved) {
          const progress = JSON.parse(saved) as PlayProgress;
          if (progress.lastChapterId) {
            router.replace(
              `/story/${storyId}/play?chapter=${progress.lastChapterId}`
            );
            return;
          }
        }
      } catch {
        /* ignore */
      }
      router.replace(
        `/story/${storyId}/play?chapter=${chapters[0].id}`
      );
    }
  }, [chapterId, chapters, storyId, router]);

  // ── 자동 스크롤 ──
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [playMessages, isSending]);

  // ── 첫 턴 자동 호출 ──
  // pendingInitialTurn이 true이고 chapter가 로드됐을 때 AI 첫 응답 요청
  useEffect(() => {
    if (!pendingInitialTurn || isSending || !chapter || !pendingSetupRef.current) return;
    setPendingInitialTurn(false);

    const setup = pendingSetupRef.current;
    const initialStatus: CharacterStatus = {
      ...DEFAULT_STATUS,
      name: setup.name,
      gender: setup.gender,
      faction: setup.faction,
    };

    setIsSending(true);

    fetch(`/api/stories/${storyId}/play-message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userMessage: "이야기를 시작합니다.",
        chapterTitle: chapter.title,
        chapterContent: chapter.content,
        playerSetup: setup,
        currentStatus: initialStatus,
        turnCount: 0,
        isInitialTurn: true,
      }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((data: { rawReply: string }) => {
        const { story: storyContent, rawStatus, choices } = parseAIResponse(
          data.rawReply
        );
        const newStatus = parseStatusUpdate(rawStatus, initialStatus);
        setCharStatus(newStatus);
        try {
          localStorage.setItem(
            lsStatusKey(storyId, branchId),
            JSON.stringify(newStatus)
          );
        } catch { /* ignore */ }

        const initMsg: PlayMessage = {
          id: `ai-init-${Date.now()}`,
          role: "ASSISTANT",
          content: storyContent,
          choices,
          createdAt: new Date().toISOString(),
        };
        setPlayMessages([initMsg]);
        try {
          localStorage.setItem(
            lsMsgKey(storyId, chapterId ?? "", branchId),
            JSON.stringify([initMsg])
          );
        } catch { /* ignore */ }

        if (choices.length > 0) {
          setCurrentChoices(choices);
          setStatusPanelOpen(true);
        }
      })
      .catch((err) => console.error("[initialTurn]", err))
      .finally(() => setIsSending(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInitialTurn, chapter, isSending]);

  // ── 자동재생 트리거 ──
  useEffect(() => {
    if (!isAutoPlaying || isSending || autoPlayRemaining <= 0) return;
    const timer = setTimeout(() => {
      if (!isAutoPlayingRef.current || autoPlayRemainingRef.current <= 0)
        return;
      const choices = currentChoicesRef.current;
      const action =
        choices.length > 0 ? choices[0] : "이야기를 계속 진행한다.";
      handleSendRef.current(action);
    }, 800);
    return () => clearTimeout(timer);
  }, [isAutoPlaying, isSending, autoPlayRemaining]);

  // ── 진행 저장 ──
  function saveProgress(currentChapterId: string) {
    try {
      const saved = localStorage.getItem(lsProgressKey(storyId));
      const progress: PlayProgress = saved
        ? (JSON.parse(saved) as PlayProgress)
        : { lastChapterId: currentChapterId, completedChapterIds: [] };
      progress.lastChapterId = currentChapterId;
      localStorage.setItem(
        lsProgressKey(storyId),
        JSON.stringify(progress)
      );
    } catch {
      /* ignore */
    }
  }

  // ── 시작설정 확정 ──
  function handleSetupConfirm(setup: PlayerSetup) {
    setPlayerSetup(setup);
    setShowStartModal(false);
    try {
      localStorage.setItem(
        lsSetupKey(storyId, branchId),
        JSON.stringify(setup)
      );
    } catch {
      /* ignore */
    }
    const initialStatus: CharacterStatus = {
      ...DEFAULT_STATUS,
      name: setup.name,
      gender: setup.gender,
      faction: setup.faction,
    };
    setCharStatus(initialStatus);
    try {
      localStorage.setItem(
        lsStatusKey(storyId, branchId),
        JSON.stringify(initialStatus)
      );
    } catch {
      /* ignore */
    }

    // 메시지가 없는 경우 → 첫 턴 AI 자동 호출
    if (playMessages.length === 0) {
      pendingSetupRef.current = setup;
      setPendingInitialTurn(true);
    }

    // DB 세션 생성 (chapterId가 있을 때)
    if (chapterId) {
      fetch("/api/play-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyId,
          chapterId,
          branchId: branchId ?? null,
          playerSetup: setup,
          charStatus: initialStatus,
        }),
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

  // ── 메시지 전송 ──
  const handleSend = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed || isSending) return;

      setLastUserMessage(trimmed);

      const tempId = `temp-user-${Date.now()}`;
      const tempUserMsg: PlayMessage = {
        id: tempId,
        role: "USER",
        content: trimmed,
        createdAt: new Date().toISOString(),
      };
      setPlayMessages((prev) => [...prev, tempUserMsg]);
      setIsSending(true);
      setInputValue("");
      setCurrentChoices([]);

      try {
        const res = await fetch(
          `/api/stories/${storyId}/play-message`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userMessage: trimmed,
              chapterTitle: chapter?.title ?? "",
              chapterContent: chapter?.content ?? "",
              playerSetup,
              currentStatus: charStatus,
              turnCount: turnCount + 1,
            }),
          }
        );

        if (!res.ok) {
          setPlayMessages((prev) => prev.filter((m) => m.id !== tempId));
          if (res.status === 401) router.push("/login");
          return;
        }

        const data = (await res.json()) as { rawReply: string };
        const {
          story: storyContent,
          rawStatus,
          choices,
        } = parseAIResponse(data.rawReply);

        // STATUS 업데이트
        const newStatus = parseStatusUpdate(rawStatus, charStatus);
        setCharStatus(newStatus);
        try {
          localStorage.setItem(
            lsStatusKey(storyId, branchId),
            JSON.stringify(newStatus)
          );
        } catch {
          /* ignore */
        }

        const newTurn = turnCount + 1;
        setTurnCount(newTurn);

        const assistantMsg: PlayMessage = {
          id: `ai-${Date.now()}`,
          role: "ASSISTANT",
          content: storyContent,
          choices,
          createdAt: new Date().toISOString(),
        };

        setPlayMessages((prev) => {
          const updated = [
            ...prev.filter((m) => m.id !== tempId),
            { ...tempUserMsg, id: `user-${Date.now()}` },
            assistantMsg,
          ];
          // 메시지를 localStorage에 저장 (분기/복원 지원)
          try {
            localStorage.setItem(
              lsMsgKey(storyId, chapterId ?? "", branchId),
              JSON.stringify(updated)
            );
          } catch {
            /* ignore */
          }
          return updated;
        });

        if (choices.length > 0) {
          setCurrentChoices(choices);
          setStatusPanelOpen(true);
        }

        // 진행 저장
        saveProgress(chapterId ?? "");

        // DB 플레이 세션 업데이트
        const sessionIdToUpdate = playSessionId;
        if (sessionIdToUpdate) {
          // 기존 세션에 상태 + 메시지 추가
          fetch(`/api/play-sessions/${sessionIdToUpdate}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              charStatus: newStatus,
              turnCount: newTurn,
              lastMessage: storyContent.slice(0, 100),
              messages: [
                { role: "USER", content: trimmed },
                { role: "ASSISTANT", content: storyContent, choices },
              ],
            }),
          })
            .then(() => swrMutate("/api/play-sessions?limit=10"))
            .catch(() => {});
        } else if (chapterId) {
          // 세션이 없으면 (setup 없이 시작한 경우) 생성
          fetch("/api/play-sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              storyId,
              chapterId,
              branchId: branchId ?? null,
              playerSetup: playerSetup ?? {},
              charStatus: newStatus,
            }),
          })
            .then((r) => (r.ok ? r.json() : null))
            .then((created: { id: string } | null) => {
              if (created?.id) {
                setPlaySessionId(created.id);
                const url = new URL(window.location.href);
                url.searchParams.set("session", created.id);
                window.history.replaceState({}, "", url.toString());
                // 첫 메시지들도 저장
                fetch(`/api/play-sessions/${created.id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    turnCount: newTurn,
                    lastMessage: storyContent.slice(0, 100),
                    messages: [
                      { role: "USER", content: trimmed },
                      { role: "ASSISTANT", content: storyContent, choices },
                    ],
                  }),
                })
                  .then(() => swrMutate("/api/play-sessions?limit=10"))
                  .catch(() => {});
              }
            })
            .catch(() => {});
        }

        // 자동재생: 남은 횟수 차감
        if (isAutoPlayingRef.current) {
          const next = autoPlayRemainingRef.current - 1;
          autoPlayRemainingRef.current = next;
          setAutoPlayRemaining(next);
          if (next <= 0) {
            isAutoPlayingRef.current = false;
            setIsAutoPlaying(false);
          }
        }
      } catch (err) {
        console.error("[StoryPlayPage] 전송 오류:", err);
        setPlayMessages((prev) => prev.filter((m) => m.id !== tempId));
      } finally {
        setIsSending(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isSending, chapter, storyId, chapterId, branchId, playerSetup, charStatus, turnCount, router, playSessionId]
  );

  // handleSend ref 동기화 (자동재생용)
  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

  // ── 재생성 ──
  function handleRegenerate() {
    if (!lastUserMessage || isSending) return;
    setPlayMessages((prev) => {
      const msgs = [...prev];
      // 마지막 ASSISTANT 메시지 제거
      for (let i = msgs.length - 1; i >= 0; i--) {
        if (msgs[i].role === "ASSISTANT") {
          msgs.splice(i, 1);
          break;
        }
      }
      return msgs;
    });
    setCurrentChoices([]);
    // 동일 메시지로 재전송 (약간의 딜레이)
    setTimeout(() => handleSend(lastUserMessage), 100);
  }

  // ── 분기 ──
  function handleBranch() {
    if (!chapterId || !playerSetup) return;
    const newBranchId = `${Date.now()}`;
    try {
      localStorage.setItem(
        lsSetupKey(storyId, newBranchId),
        JSON.stringify(playerSetup)
      );
      localStorage.setItem(
        lsStatusKey(storyId, newBranchId),
        JSON.stringify(charStatus)
      );
      localStorage.setItem(
        lsMsgKey(storyId, chapterId, newBranchId),
        JSON.stringify(playMessages)
      );
    } catch {
      /* ignore */
    }
    router.push(
      `/story/${storyId}/play?chapter=${chapterId}&branch=${newBranchId}`
    );
  }

  // ── 자동재생 토글 ──
  function handleAutoPlayToggle() {
    if (isAutoPlaying) {
      isAutoPlayingRef.current = false;
      autoPlayRemainingRef.current = 0;
      setIsAutoPlaying(false);
      setAutoPlayRemaining(0);
    } else {
      isAutoPlayingRef.current = true;
      autoPlayRemainingRef.current = 3;
      setIsAutoPlaying(true);
      setAutoPlayRemaining(3);
    }
  }

  // ── 챕터 네비게이션 ──
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
    // 챕터 이동 시 자동재생 중단
    isAutoPlayingRef.current = false;
    setIsAutoPlaying(false);
    setAutoPlayRemaining(0);
    const url = branchId
      ? `/story/${storyId}/play?chapter=${chapters[targetIdx].id}&branch=${branchId}`
      : `/story/${storyId}/play?chapter=${chapters[targetIdx].id}`;
    router.push(url);
  }

  const currentChapterIdx = chapter
    ? chapters.findIndex((c) => c.id === chapter.id)
    : -1;
  const hasPrev = currentChapterIdx > 0;
  const hasNext =
    currentChapterIdx >= 0 && currentChapterIdx < chapters.length - 1;

  // 마지막 메시지가 ASSISTANT인지 확인 (재생성 버튼 표시용)
  const lastMsg = playMessages[playMessages.length - 1];
  const canRegenerate =
    lastMsg?.role === "ASSISTANT" && !!lastUserMessage && !isSending;

  // ─────────────────────────────────────────────
  // 렌더링
  // ─────────────────────────────────────────────

  if (isLoading) return <LoadingSkeleton />;
  if (loadError) return <ErrorScreen message={loadError} />;
  if (!chapter || !story)
    return <ErrorScreen message="챕터를 불러올 수 없습니다." />;

  const isWuxia = story.genre?.includes("무협");

  return (
    <>
      {/* 시작설정 모달 */}
      {showStartModal && (
        <StartSettingsModal
          storyTitle={story.title}
          genre={story.genre ?? []}
          onConfirm={handleSetupConfirm}
        />
      )}

      {/* STATUS 패널 (우측 슬라이드) */}
      <CharacterStatusPanel
        status={charStatus}
        turnCount={turnCount}
        isOpen={statusPanelOpen}
        onToggle={() => setStatusPanelOpen((v) => !v)}
      />

      {/* 메인 레이아웃 */}
      <div
        className="fixed top-14 bottom-0 left-0 md:left-60 flex flex-col bg-bg z-10 overflow-hidden transition-all duration-300"
        style={{ right: statusPanelOpen ? "256px" : "28px" }}
      >
        {/* ── 헤더 ── */}
        <header className="h-14 bg-bg2 border-b border-bg3 flex items-center px-4 gap-3 shrink-0">
          <button
            type="button"
            onClick={() => router.push(`/stories/${storyId}`)}
            aria-label="뒤로"
            className="w-8 h-8 flex items-center justify-center text-t2 hover:text-t1 transition-colors rounded-lg hover:bg-bg3 shrink-0"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          <div className="flex-1 min-w-0">
            <p className="text-t1 font-semibold text-sm truncate">
              {story.title}
              <span className="text-t2 font-normal">
                {" "}
                — {chapter.orderIndex}화: {chapter.title}
              </span>
            </p>
          </div>

          {/* 분기 뱃지 */}
          {branchId && (
            <div className="shrink-0 px-2 py-0.5 rounded-md bg-purple-500/20 border border-purple-500/40">
              <span className="text-xs text-purple-300">분기</span>
            </div>
          )}

          {/* 자동재생 중 표시 */}
          {isAutoPlaying && (
            <div className="shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-500/20 border border-green-500/40">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              <span className="text-xs text-green-300">
                자동 {autoPlayRemaining}턴
              </span>
            </div>
          )}

          {/* 세력 배지 */}
          {playerSetup && (
            <div className="shrink-0 px-2.5 py-1 rounded-lg bg-bg3 border border-bg3">
              <span className="text-xs text-t2">{playerSetup.faction}</span>
            </div>
          )}

          {/* 시작설정 재설정 */}
          <button
            type="button"
            onClick={() => setShowStartModal(true)}
            aria-label="시작설정"
            title="시작설정 다시 하기"
            className="w-8 h-8 flex items-center justify-center text-t2 hover:text-t1 transition-colors rounded-lg hover:bg-bg3 shrink-0"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
            </svg>
          </button>
        </header>

        {/* ── 본문 + 대화 (스크롤) ── */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <article className="px-6 py-8 max-w-2xl mx-auto">
            <h2 className="text-t1 font-bold text-lg mb-6">
              {chapter.orderIndex}화. {chapter.title}
            </h2>
            <div className="text-t2 leading-8 text-sm whitespace-pre-wrap">
              {parseStoryMarkdown(chapter.content)}
            </div>
          </article>

          <div className="border-t border-bg3 mx-6" />

          <div className="px-4 py-4 max-w-2xl mx-auto space-y-4">
            {playMessages.length === 0 &&
              !isSending &&
              !showStartModal && (
                <div className="text-center py-6">
                  <p className="text-xs text-t2 mb-2">
                    이야기에 참여해보세요.
                  </p>
                  {playerSetup && (
                    <p className="text-xs text-t2/50">
                      {playerSetup.name} · {playerSetup.faction} ·{" "}
                      {playerSetup.gender}
                    </p>
                  )}
                </div>
              )}

            {playMessages.map((msg, msgIdx) =>
              msg.role === "USER" ? (
                <div key={msg.id} className="flex justify-end">
                  <div className="bg-red/20 text-t1 rounded-2xl rounded-tr-sm px-4 py-3 max-w-[75%] text-sm leading-relaxed">
                    {msg.content.split("\n").map((line, i) => (
                      <span key={i}>
                        {i > 0 && <br />}
                        {line}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div key={msg.id} className="flex flex-col items-start gap-1">
                  <div className="bg-bg2 text-t1 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%] text-sm leading-relaxed">
                    {parseStoryMarkdown(msg.content)}
                  </div>
                  {/* 재생성 버튼 — 마지막 ASSISTANT 메시지에만 표시 */}
                  {msgIdx === playMessages.length - 1 &&
                    canRegenerate && (
                      <button
                        type="button"
                        onClick={handleRegenerate}
                        title="다시 생성"
                        className="flex items-center gap-1 px-2 py-1 text-xs text-t2 hover:text-t1 rounded-lg hover:bg-bg3 transition-colors"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="1 4 1 10 7 10" />
                          <path d="M3.51 15a9 9 0 1 0 .49-3.92" />
                        </svg>
                        다시 생성
                      </button>
                    )}
                </div>
              )
            )}

            {isSending && (
              <div className="flex justify-start">
                <div className="bg-bg2 rounded-2xl rounded-tl-sm px-4">
                  <DotsTyping />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── 추천답변 + 입력 영역 ── */}
        <div className="border-t border-bg3 bg-bg shrink-0">
          {/* CHOICES 버튼 */}
          {currentChoices.length > 0 && !isSending && (
            <div className="px-4 pt-3 pb-0 max-w-2xl mx-auto w-full">
              <p className="text-xs text-t2 mb-2">
                {isWuxia ? "⚔ 다음 행동" : "💬 선택지"}
              </p>
              <div className="flex flex-col gap-1.5">
                {currentChoices.map((choice, i) => (
                  <button
                    key={i}
                    type="button"
                    disabled={isSending}
                    onClick={() => handleSend(choice)}
                    className="text-left px-4 py-2.5 bg-bg3 hover:bg-bg2 text-t1 text-sm rounded-xl transition-colors border border-bg3 hover:border-t2/30 disabled:opacity-50"
                  >
                    {choice}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 툴바 (분기 + 자동재생) */}
          <div className="px-4 pt-2 pb-0 flex items-center gap-2 max-w-2xl mx-auto w-full">
            {/* 분기 버튼 */}
            <button
              type="button"
              onClick={handleBranch}
              disabled={playMessages.length === 0 || isSending}
              title="현재 시점에서 분기 생성"
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-t2 hover:text-t1 rounded-lg border border-bg3 hover:border-t2/30 hover:bg-bg3 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="6" y1="3" x2="6" y2="15" />
                <circle cx="18" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <path d="M18 9a9 9 0 0 1-9 9" />
              </svg>
              분기
            </button>

            {/* 자동재생 버튼 */}
            <button
              type="button"
              onClick={handleAutoPlayToggle}
              disabled={isSending && !isAutoPlaying}
              title={isAutoPlaying ? "자동재생 중단" : "자동재생 (3턴)"}
              className={[
                "flex items-center gap-1 px-3 py-1.5 text-xs rounded-lg border transition-colors",
                isAutoPlaying
                  ? "text-green-300 border-green-500/40 bg-green-500/10 hover:bg-green-500/20"
                  : "text-t2 hover:text-t1 border-bg3 hover:border-t2/30 hover:bg-bg3",
                "disabled:opacity-30 disabled:cursor-not-allowed",
              ].join(" ")}
            >
              {isAutoPlaying ? (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                  중단
                </>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <polygon points="5 3 19 12 5 21 5 3" />
                  </svg>
                  자동재생
                </>
              )}
            </button>
          </div>

          {/* 직접 입력 */}
          <div className="px-4 pt-2 pb-safe-or-4 max-w-2xl mx-auto w-full">
            <div className="flex items-end gap-2">
              <textarea
                ref={textareaRef}
                value={inputValue}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => {
                  setInputValue(e.target.value);
                  adjustHeight();
                }}
                onKeyDown={(e: KeyboardEvent<HTMLTextAreaElement>) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(inputValue);
                  }
                }}
                disabled={isSending}
                rows={1}
                maxLength={500}
                placeholder={isSending ? "생성 중..." : "행동이나 대화를 입력하세요..."}
                className="flex-1 bg-bg2 border border-bg3 focus:border-red/50 rounded-xl px-4 py-2.5 text-sm text-t1 placeholder:text-t2 outline-none resize-none transition-colors scrollbar-hide"
                style={{ minHeight: "40px", maxHeight: "120px" }}
              />
              <button
                type="button"
                onClick={() => handleSend(inputValue)}
                disabled={isSending || inputValue.trim().length === 0}
                aria-label="전송"
                className="shrink-0 w-10 h-10 flex items-center justify-center bg-red hover:bg-red/80 disabled:bg-red/30 text-white rounded-xl transition-colors"
              >
                {isSending ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="animate-spin"
                    aria-hidden="true"
                  >
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                )}
              </button>
            </div>

            {/* 챕터 네비게이션 */}
            <div className="flex items-center justify-between mt-2">
              <button
                type="button"
                onClick={() => navigateChapter("prev")}
                disabled={!hasPrev}
                className="flex items-center gap-1 px-2 py-1 text-xs text-t2 hover:text-t1 rounded-lg hover:bg-bg3 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                이전 화
              </button>
              <span className="text-xs text-t2">
                {currentChapterIdx + 1} / {chapters.length}
              </span>
              <button
                type="button"
                onClick={() => navigateChapter("next")}
                disabled={!hasNext}
                className="flex items-center gap-1 px-2 py-1 text-xs text-t2 hover:text-t1 rounded-lg hover:bg-bg3 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                다음 화
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
