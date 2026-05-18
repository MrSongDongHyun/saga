"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { MessageBubble } from "@/components/chat/MessageBubble";
import { TypingIndicator } from "@/components/chat/TypingIndicator";
import { MessageInput } from "@/components/chat/MessageInput";
import ImageGenModal from "@/components/ui/ImageGenModal";
import {
  DEFAULT_MODEL,
  type ClaudeModelId,
} from "@/lib/constants/models";
import { ModelDropdown } from "@/components/ui/ModelDropdown";

type MessageRole = "USER" | "ASSISTANT" | "SYSTEM";
type ChatMessage = { id: string; role: MessageRole; content: string; createdAt: string };
type CharacterInfo = { id: string; name: string; avatar: string | null; description: string | null; firstMessage: string | null };
type SessionData = {
  id: string;
  character: CharacterInfo;
  title: string | null;
  messageCount: number;
  model: ClaudeModelId;
  createdAt: string;
  updatedAt: string;
};
type MessagesResponse = { messages: ChatMessage[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
type SendMessageResponse = { userMessage: ChatMessage; assistantMessage: ChatMessage };

function lsUserNoteKey(sid: string) { return `saga-chat-usernote-${sid}`; }

function LoadingSkeleton() {
  return (
    <div className="flex flex-col h-screen bg-bg">
      <div className="h-14 bg-bg2 border-b border-bg3 flex items-center px-4 gap-3 shrink-0">
        <div className="w-6 h-6 bg-bg3 rounded animate-pulse" />
        <div className="w-8 h-8 bg-bg3 rounded-full animate-pulse" />
        <div className="w-24 h-4 bg-bg3 rounded animate-pulse" />
      </div>
      <div className="flex-1 p-4 space-y-4">
        {[1,2,3].map((i) => (
          <div key={i} className="flex gap-2">
            <div className="w-8 h-8 bg-bg3 rounded-full animate-pulse shrink-0" />
            <div className="w-48 h-16 bg-bg3 rounded-2xl animate-pulse" />
          </div>
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

type SettingsPanelProps = {
  open: boolean;
  onClose: () => void;
  userNote: string;
  onUserNoteChange: (v: string) => void;
  characterName: string;
  onOpenImageGen: () => void;
  selectedModel: ClaudeModelId;
  onModelChange: (model: ClaudeModelId) => void;
  modelSaving: boolean;
};

function SettingsPanel({
  open, onClose, userNote, onUserNoteChange,
  characterName, onOpenImageGen,
  selectedModel, onModelChange, modelSaving,
}: SettingsPanelProps) {
  return (
    <>
      {open && <div className="fixed inset-0 bg-black/40 z-20" onClick={onClose} aria-hidden="true" />}
      <aside
        className={[
          "fixed top-0 right-0 h-full w-72 bg-bg2 border-l border-bg3 z-30 flex flex-col shadow-xl transition-transform duration-200",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
        aria-label="채팅 설정"
      >
        <div className="h-14 flex items-center justify-between px-4 border-b border-bg3 shrink-0">
          <h2 className="text-sm font-semibold text-t1">채팅 설정</h2>
          <button
            type="button" onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-t2 hover:text-t1 transition-colors rounded-lg hover:bg-bg3"
            aria-label="닫기"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">

          {/* ── Claude 모델 선택 ── */}
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-t1">Claude 모델</h3>
              {modelSaving && (
                <span className="text-xs text-t2 animate-pulse">저장 중…</span>
              )}
            </div>
            <p className="text-xs text-t2 leading-relaxed">이 채팅에서 사용할 AI 모델을 선택합니다.</p>
            <ModelDropdown value={selectedModel} onChange={onModelChange} disabled={modelSaving} />
          </section>

          {/* ── 나의 메모 ── */}
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-t1">나의 메모</h3>
            <p className="text-xs text-t2 leading-relaxed">
              {characterName}과의 대화에서 AI가 항상 기억했으면 하는 정보를 입력하세요.
            </p>
            <textarea
              value={userNote}
              onChange={(e) => onUserNoteChange(e.target.value)}
              rows={8}
              maxLength={1000}
              placeholder={`예시: 내 이름은 지호야. ${characterName}와 나는 소꿉친구 사이야.`}
              className="bg-bg border border-bg3 focus:border-red/50 rounded-lg px-3 py-2 text-sm text-t1 placeholder:text-t2 outline-none resize-none transition-colors"
            />
            <p className="text-xs text-t2 text-right">{userNote.length} / 1000</p>
            <p className="text-xs text-t2">입력한 내용은 이 기기에 자동 저장됩니다.</p>
          </section>

          {/* ── 이미지 생성 ── */}
          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-semibold text-t1">이미지 생성</h3>
            <p className="text-xs text-t2 leading-relaxed">Stable Diffusion WebUI를 통해 캐릭터 이미지를 생성합니다.</p>
            <button
              type="button"
              onClick={onOpenImageGen}
              className="w-full border border-bg3 hover:border-red/40 text-t2 hover:text-t1 text-xs py-2 rounded-lg transition-colors"
            >
              이미지 생성 열기
            </button>
          </section>

        </div>
      </aside>
    </>
  );
}

export default function ChatPage() {
  const params = useParams<{ sessionId: string }>();
  const router = useRouter();
  const sessionId = params.sessionId;

  const [session, setSession] = useState<SessionData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [imageGenOpen, setImageGenOpen] = useState(false);
  const [userNote, setUserNote] = useState("");
  const [selectedModel, setSelectedModel] = useState<ClaudeModelId>(DEFAULT_MODEL);
  const [modelSaving, setModelSaving] = useState(false);
  const userNoteKey = lsUserNoteKey(sessionId);

  useEffect(() => {
    const saved = localStorage.getItem(userNoteKey);
    if (saved !== null) setUserNote(saved);
  }, [userNoteKey]);

  function handleUserNoteChange(v: string) {
    setUserNote(v);
    localStorage.setItem(userNoteKey, v);
  }

  // 모델 변경 → PATCH /api/chat/sessions/[sessionId]
  async function handleModelChange(model: ClaudeModelId) {
    if (model === selectedModel || modelSaving) return;
    setModelSaving(true);
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      });
      if (res.ok) setSelectedModel(model);
    } catch {
      /* 무시 */
    } finally {
      setModelSaving(false);
    }
  }

  const bottomRef = useRef<HTMLDivElement>(null);
  const messagesAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadSession() {
      try {
        const [sessionRes, messagesRes] = await Promise.all([
          fetch(`/api/chat/sessions/${sessionId}`),
          fetch(`/api/chat/sessions/${sessionId}/messages?page=1&limit=50`),
        ]);
        if (cancelled) return;
        if (!sessionRes.ok) {
          if (sessionRes.status === 401) { router.push("/login"); return; }
          const data: unknown = await sessionRes.json().catch(() => ({}));
          const msg =
            typeof data === "object" && data !== null && "error" in data &&
            typeof (data as { error: unknown }).error === "string"
              ? (data as { error: string }).error
              : "세션을 불러올 수 없습니다.";
          setLoadError(msg); return;
        }
        if (!messagesRes.ok) { setLoadError("메시지를 불러올 수 없습니다."); return; }
        const sessionData: SessionData = await sessionRes.json();
        const messagesData: MessagesResponse = await messagesRes.json();
        if (cancelled) return;
        setSession(sessionData);
        setMessages(messagesData.messages);
        // 세션에 저장된 모델 적용
        if (sessionData.model) setSelectedModel(sessionData.model);
      } catch (err) {
        if (cancelled) return;
        console.error("[ChatPage] 초기 로딩 오류:", err);
        setLoadError("네트워크 오류가 발생했습니다.");
      } finally {
        if (!cancelled) setIsInitialLoading(false);
      }
    }
    loadSession();
    return () => { cancelled = true; };
  }, [sessionId, router]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, isTyping]);

  const handleSend = useCallback(async (content: string) => {
    if (isSending) return;
    const tempId = `temp-${Date.now()}`;
    const streamingId = `streaming-${Date.now()}`;
    const tempUserMessage: ChatMessage = {
      id: tempId, role: "USER", content, createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMessage]);
    setIsSending(true);
    setIsTyping(true);
    try {
      const currentNote = localStorage.getItem(lsUserNoteKey(sessionId)) ?? "";
      const res = await fetch(`/api/chat/sessions/${sessionId}/stream`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, userNote: currentNote }),
      });
      if (!res.ok || !res.body) {
        setMessages((prev) => prev.filter((m) => m.id !== tempId));
        if (res.status === 401) { router.push("/login"); return; }
        console.error("[ChatPage] 스트리밍 실패:", res.status); return;
      }
      // 스트리밍 placeholder 추가
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        { id: streamingId, role: "ASSISTANT", content: "", createdAt: new Date().toISOString() },
      ]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
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
              type: string; text?: string;
              userMessageId?: string; assistantMessageId?: string;
              assistantContent?: string; createdAt?: string; message?: string;
            };
            if (evt.type === "chunk" && evt.text) {
              setMessages((prev) => prev.map((m) =>
                m.id === streamingId ? { ...m, content: m.content + evt.text! } : m
              ));
            } else if (evt.type === "done") {
              setMessages((prev) => [
                ...prev.filter((m) => m.id !== tempId && m.id !== streamingId),
                { id: evt.userMessageId!, role: "USER", content, createdAt: new Date().toISOString() },
                { id: evt.assistantMessageId!, role: "ASSISTANT", content: evt.assistantContent!, createdAt: evt.createdAt! },
              ]);
            } else if (evt.type === "error") {
              setMessages((prev) => prev.filter((m) => m.id !== streamingId));
            }
          } catch { /* JSON 파싱 오류 무시 */ }
        }
      }
    } catch (err) {
      console.error("[ChatPage] 스트리밍 오류:", err);
      setMessages((prev) => prev.filter((m) => m.id !== tempId && m.id !== streamingId));
    } finally {
      setIsSending(false);
      setIsTyping(false);
    }
  }, [isSending, sessionId, router]);

  if (isInitialLoading) return <LoadingSkeleton />;
  if (loadError) return <ErrorScreen message={loadError} />;
  if (!session) return <ErrorScreen message="세션 정보가 없습니다." />;

  const { character } = session;

  return (
    <div className="fixed inset-0 flex flex-col bg-bg z-10">
      {/* 헤더 */}
      <header className="h-14 bg-bg2 border-b border-bg3 flex items-center px-4 gap-3 shrink-0">
        <button type="button" onClick={() => router.back()} aria-label="뒤로 가기"
          className="w-8 h-8 flex items-center justify-center text-t2 hover:text-t1 transition-colors rounded-lg hover:bg-bg3">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        {character.avatar ? (
          <Image src={character.avatar} alt={character.name} width={32} height={32} className="w-8 h-8 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-red/20 text-red flex items-center justify-center text-xs font-bold shrink-0 select-none">
            {character.name[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <span className="text-t1 font-semibold text-sm truncate block">{character.name}</span>
        </div>
        {/* 모델 선택 드롭다운 */}
        <ModelDropdown
          value={selectedModel}
          onChange={handleModelChange}
          disabled={modelSaving}
        />
        {userNote.trim().length > 0 && (
          <span className="text-xs text-red/70 shrink-0">메모 ON</span>
        )}
        <button type="button" onClick={() => setSettingsOpen(true)} aria-label="설정"
          className="w-8 h-8 flex items-center justify-center text-t2 hover:text-t1 transition-colors rounded-lg hover:bg-bg3">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
          </svg>
        </button>
      </header>

      {/* 설정 패널 */}
      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        userNote={userNote}
        onUserNoteChange={handleUserNoteChange}
        characterName={character.name}
        onOpenImageGen={() => { setSettingsOpen(false); setImageGenOpen(true); }}
        selectedModel={selectedModel}
        onModelChange={handleModelChange}
        modelSaving={modelSaving}
      />

      {/* 이미지 생성 모달 */}
      <ImageGenModal
        open={imageGenOpen}
        onClose={() => setImageGenOpen(false)}
        defaultPrompt={`${character.name}, anime style, detailed, masterpiece`}
      />

      {/* 메시지 영역 */}
      <div ref={messagesAreaRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-hide">
        {messages.length === 0 && !isTyping && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
            {character.avatar ? (
              <Image src={character.avatar} alt={character.name} width={64} height={64} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-red/20 text-red flex items-center justify-center text-2xl font-bold select-none">
                {character.name[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <p className="text-t1 font-semibold">{character.name}</p>
            {character.description && (
              <p className="text-t2 text-sm leading-relaxed max-w-xs">{character.description}</p>
            )}
            {character.firstMessage && (
              <div className="mt-2 bg-bg2 rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-t1 max-w-xs text-left">
                {character.firstMessage}
              </div>
            )}
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            role={msg.role}
            content={msg.content}
            createdAt={msg.createdAt}
            characterName={character.name}
            characterAvatar={character.avatar}
          />
        ))}
        {isTyping && <TypingIndicator characterName={character.name} characterAvatar={character.avatar} />}
        <div ref={bottomRef} />
      </div>

      {/* 입력창 */}
      <MessageInput onSend={handleSend} disabled={isSending} placeholder={`${character.name}에게 메시지 보내기...`} />
    </div>
  );
}
