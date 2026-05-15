"use client";

// 이미지 생성 모달 컴포넌트
// POST /api/generate/image 호출 후 결과 이미지 표시
import { useState } from "react";
import Image from "next/image";

// ─────────────────────────────────────────────
// 타입
// ─────────────────────────────────────────────
type Props = {
  open: boolean;
  onClose: () => void;
  /** 캐릭터명 등을 기반으로 기본 프롬프트 자동 설정 */
  defaultPrompt?: string;
};

type GenerateResult = {
  base64: string;
  seed: number;
};

// ─────────────────────────────────────────────
// ImageGenModal
// ─────────────────────────────────────────────
export default function ImageGenModal({ open, onClose, defaultPrompt = "" }: Props) {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [negativePrompt, setNegativePrompt] = useState(
    "lowres, bad anatomy, bad hands, text, error, blurry, ugly"
  );
  const [width, setWidth] = useState(512);
  const [height, setHeight] = useState(512);
  const [steps, setSteps] = useState(20);
  const [cfgScale, setCfgScale] = useState(7);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResult | null>(null);

  if (!open) return null;

  // ─────────────────────────────────
  // 생성 요청
  // ─────────────────────────────────
  async function handleGenerate() {
    if (!prompt.trim()) {
      setErrorMsg("프롬프트를 입력해주세요.");
      return;
    }
    setErrorMsg(null);
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          negativePrompt: negativePrompt.trim() || undefined,
          width,
          height,
          steps,
          cfgScale,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error ?? "이미지 생성에 실패했습니다.");
        return;
      }

      setResult({ base64: data.base64, seed: data.seed });
    } catch {
      setErrorMsg("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  // ─────────────────────────────────
  // 이미지 다운로드
  // ─────────────────────────────────
  function handleDownload() {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.base64;
    a.download = `saga-image-${result.seed}.png`;
    a.click();
  }

  return (
    <>
      {/* 오버레이 */}
      <div
        className="fixed inset-0 bg-black/60 z-[70]"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 모달 */}
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        aria-label="이미지 생성"
      >
        <div
          className="bg-bg2 border border-bg3 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-bg3">
            <h2 className="text-base font-semibold text-t1">이미지 생성</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-t2 hover:text-t1 transition-colors rounded-lg hover:bg-bg3"
              aria-label="닫기"
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
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="p-5 flex flex-col gap-4">
            {/* 에러 */}
            {errorMsg && (
              <div className="px-3 py-2 bg-red/10 border border-red/30 rounded-lg text-red text-sm">
                {errorMsg}
              </div>
            )}

            {/* 프롬프트 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-t1">
                프롬프트 <span className="text-red">*</span>
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="1girl, silver hair, blue eyes, fantasy armor, detailed, masterpiece"
                className="bg-bg1 border border-bg3 focus:border-red/50 rounded-lg px-3 py-2 text-sm text-t1 placeholder:text-t2 outline-none resize-none transition-colors"
              />
            </div>

            {/* 네거티브 프롬프트 */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-t1">
                네거티브 프롬프트
              </label>
              <textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                rows={2}
                placeholder="lowres, bad anatomy, bad hands, text, error, blurry"
                className="bg-bg1 border border-bg3 focus:border-red/50 rounded-lg px-3 py-2 text-sm text-t1 placeholder:text-t2 outline-none resize-none transition-colors"
              />
            </div>

            {/* 해상도 + 스텝 */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-t1">너비 (px)</label>
                <select
                  value={width}
                  onChange={(e) => setWidth(Number(e.target.value))}
                  className="bg-bg1 border border-bg3 rounded-lg px-3 py-2 text-sm text-t1 outline-none"
                >
                  {[256, 384, 512, 640, 768, 1024].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-t1">높이 (px)</label>
                <select
                  value={height}
                  onChange={(e) => setHeight(Number(e.target.value))}
                  className="bg-bg1 border border-bg3 rounded-lg px-3 py-2 text-sm text-t1 outline-none"
                >
                  {[256, 384, 512, 640, 768, 1024].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-t1">
                  스텝 ({steps})
                </label>
                <input
                  type="range"
                  min={5}
                  max={50}
                  value={steps}
                  onChange={(e) => setSteps(Number(e.target.value))}
                  className="accent-red"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-t1">
                  CFG Scale ({cfgScale})
                </label>
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={cfgScale}
                  onChange={(e) => setCfgScale(Number(e.target.value))}
                  className="accent-red"
                />
              </div>
            </div>

            {/* 생성 버튼 */}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={loading}
              className="w-full bg-red hover:bg-red/80 disabled:bg-red/40 text-white text-sm font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  생성 중... (약 20~60초)
                </>
              ) : (
                "이미지 생성"
              )}
            </button>

            {/* 결과 이미지 */}
            {result && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-t2">
                  Seed: {result.seed}
                </p>
                <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-bg3">
                  <Image
                    src={result.base64}
                    alt="생성된 이미지"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="w-full border border-bg3 hover:border-t2/50 text-t2 hover:text-t1 text-sm py-2 rounded-lg transition-colors"
                >
                  다운로드
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
