"use client";

// 키워드북 CRUD 컴포넌트
// GET/POST/PUT/DELETE /api/characters/[id]/keywords
import { useState, useEffect } from "react";

// ─────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────
type Keyword = {
  id: string;
  keyword: string;
  content: string;
  createdAt: string;
};

type Props = {
  characterId: string;
};

// ─────────────────────────────────────────────
// KeywordBook 컴포넌트
// ─────────────────────────────────────────────
export default function KeywordBook({ characterId }: Props) {
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 추가 폼 상태
  const [addKeyword, setAddKeyword] = useState("");
  const [addContent, setAddContent] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // 편집 상태
  const [editId, setEditId] = useState<string | null>(null);
  const [editKeyword, setEditKeyword] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editing, setEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // ─────────────────────────────────────────────
  // 키워드 목록 로드
  // ─────────────────────────────────────────────
  async function loadKeywords() {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/characters/${characterId}/keywords`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "요청 실패" }));
        setErrorMsg(body.error ?? "키워드를 불러오지 못했습니다.");
        return;
      }
      const data = await res.json();
      setKeywords(data.keywords ?? []);
    } catch {
      setErrorMsg("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (characterId) loadKeywords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [characterId]);

  // ─────────────────────────────────────────────
  // 키워드 추가
  // ─────────────────────────────────────────────
  async function handleAdd() {
    setAddError(null);
    const kw = addKeyword.trim();
    const ct = addContent.trim();
    if (!kw) { setAddError("키워드를 입력해주세요."); return; }
    if (!ct) { setAddError("내용을 입력해주세요."); return; }

    setAdding(true);
    try {
      const res = await fetch(`/api/characters/${characterId}/keywords`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: kw, content: ct }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "추가 실패" }));
        setAddError(body.error ?? "키워드 추가에 실패했습니다.");
        return;
      }
      const { keyword } = await res.json();
      setKeywords((prev) => [...prev, keyword]);
      setAddKeyword("");
      setAddContent("");
    } catch {
      setAddError("네트워크 오류가 발생했습니다.");
    } finally {
      setAdding(false);
    }
  }

  // ─────────────────────────────────────────────
  // 편집 시작
  // ─────────────────────────────────────────────
  function startEdit(kw: Keyword) {
    setEditId(kw.id);
    setEditKeyword(kw.keyword);
    setEditContent(kw.content);
    setEditError(null);
  }

  function cancelEdit() {
    setEditId(null);
    setEditKeyword("");
    setEditContent("");
    setEditError(null);
  }

  // ─────────────────────────────────────────────
  // 편집 저장
  // ─────────────────────────────────────────────
  async function handleEdit() {
    if (!editId) return;
    setEditError(null);
    const kw = editKeyword.trim();
    const ct = editContent.trim();
    if (!kw) { setEditError("키워드를 입력해주세요."); return; }
    if (!ct) { setEditError("내용을 입력해주세요."); return; }

    setEditing(true);
    try {
      const res = await fetch(
        `/api/characters/${characterId}/keywords/${editId}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ keyword: kw, content: ct }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "수정 실패" }));
        setEditError(body.error ?? "키워드 수정에 실패했습니다.");
        return;
      }
      const { keyword: updated } = await res.json();
      setKeywords((prev) =>
        prev.map((k) => (k.id === editId ? updated : k))
      );
      cancelEdit();
    } catch {
      setEditError("네트워크 오류가 발생했습니다.");
    } finally {
      setEditing(false);
    }
  }

  // ─────────────────────────────────────────────
  // 삭제
  // ─────────────────────────────────────────────
  async function handleDelete(kwId: string) {
    if (!confirm("이 키워드를 삭제할까요?")) return;
    try {
      const res = await fetch(
        `/api/characters/${characterId}/keywords/${kwId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "삭제 실패" }));
        alert(body.error ?? "키워드 삭제에 실패했습니다.");
        return;
      }
      setKeywords((prev) => prev.filter((k) => k.id !== kwId));
    } catch {
      alert("네트워크 오류가 발생했습니다.");
    }
  }

  // ─────────────────────────────────────────────
  // 렌더
  // ─────────────────────────────────────────────
  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-t1">키워드북</h2>
        <p className="text-xs text-t2">
          대화 중 특정 단어가 감지되면 AI에게 자동으로 관련 정보를 제공합니다
        </p>
      </div>

      {/* 오류 */}
      {errorMsg && (
        <div className="px-3 py-2 bg-red/10 border border-red/30 rounded-lg text-red text-sm">
          {errorMsg}
        </div>
      )}

      {/* 로딩 */}
      {loading && (
        <div className="text-sm text-t2 py-4 text-center">
          불러오는 중...
        </div>
      )}

      {/* 키워드 목록 */}
      {!loading && keywords.length === 0 && (
        <div className="text-sm text-t2 py-4 text-center border border-dashed border-bg3 rounded-lg">
          등록된 키워드가 없습니다. 아래에서 추가해보세요.
        </div>
      )}

      {!loading && keywords.length > 0 && (
        <ul className="flex flex-col gap-2">
          {keywords.map((kw) =>
            editId === kw.id ? (
              // ─────────────── 편집 폼 ───────────────
              <li
                key={kw.id}
                className="bg-bg2 border border-red/40 rounded-lg p-3 flex flex-col gap-2"
              >
                {editError && (
                  <p className="text-xs text-red">{editError}</p>
                )}
                <input
                  type="text"
                  value={editKeyword}
                  onChange={(e) => setEditKeyword(e.target.value)}
                  maxLength={100}
                  placeholder="키워드 (예: 마법진, 엘프왕국)"
                  className="bg-bg1 border border-bg3 focus:border-red/50 rounded px-3 py-1.5 text-sm text-t1 placeholder:text-t2 outline-none"
                />
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={3}
                  placeholder="이 키워드가 감지될 때 AI에게 제공할 설명"
                  className="bg-bg1 border border-bg3 focus:border-red/50 rounded px-3 py-1.5 text-sm text-t1 placeholder:text-t2 outline-none resize-none"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleEdit}
                    disabled={editing}
                    className="flex-1 bg-red hover:bg-red/80 disabled:bg-red/40 text-white text-xs font-medium py-1.5 rounded transition-colors"
                  >
                    {editing ? "저장 중..." : "저장"}
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="px-4 py-1.5 border border-bg3 hover:border-t2/50 text-t2 text-xs rounded transition-colors"
                  >
                    취소
                  </button>
                </div>
              </li>
            ) : (
              // ─────────────── 키워드 행 ───────────────
              <li
                key={kw.id}
                className="bg-bg2 border border-bg3 rounded-lg p-3 flex gap-3 items-start"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-t1 truncate">
                    <span className="inline-block bg-red/10 text-red text-xs px-2 py-0.5 rounded mr-2">
                      {kw.keyword}
                    </span>
                  </p>
                  <p className="text-xs text-t2 mt-1 line-clamp-2">
                    {kw.content}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(kw)}
                    className="p-1.5 text-t2 hover:text-t1 transition-colors"
                    aria-label="편집"
                  >
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
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(kw.id)}
                    className="p-1.5 text-t2 hover:text-red transition-colors"
                    aria-label="삭제"
                  >
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
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6l-1 14H6L5 6" />
                      <path d="M10 11v6M14 11v6" />
                      <path d="M9 6V4h6v2" />
                    </svg>
                  </button>
                </div>
              </li>
            )
          )}
        </ul>
      )}

      {/* 추가 폼 */}
      <div className="border border-bg3 rounded-lg p-3 flex flex-col gap-2 bg-bg2">
        <p className="text-xs font-medium text-t1">새 키워드 추가</p>
        {addError && (
          <p className="text-xs text-red">{addError}</p>
        )}
        <input
          type="text"
          value={addKeyword}
          onChange={(e) => setAddKeyword(e.target.value)}
          maxLength={100}
          placeholder="키워드 (예: 마법진, 엘프왕국)"
          className="bg-bg1 border border-bg3 focus:border-red/50 rounded px-3 py-1.5 text-sm text-t1 placeholder:text-t2 outline-none transition-colors"
        />
        <textarea
          value={addContent}
          onChange={(e) => setAddContent(e.target.value)}
          rows={3}
          placeholder="이 키워드가 감지될 때 AI에게 제공할 설명을 입력하세요"
          className="bg-bg1 border border-bg3 focus:border-red/50 rounded px-3 py-1.5 text-sm text-t1 placeholder:text-t2 outline-none resize-none transition-colors"
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={adding}
          className="self-end bg-red hover:bg-red/80 disabled:bg-red/40 text-white text-xs font-medium px-4 py-1.5 rounded transition-colors"
        >
          {adding ? "추가 중..." : "+ 추가"}
        </button>
      </div>
    </section>
  );
}
