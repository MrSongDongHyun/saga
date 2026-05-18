"use client";

// 이미지 생성 모달 컴포넌트
// POST /api/generate/image 호출 후 결과 이미지 표시
import { useState } from "react";
import Image from "next/image";

type Props = {
  open: boolean;
  onClose: () => void;
  defaultPrompt?: string;
  /** 이미지 생성 완료 시 base64 data URL 콜백 (커버 이미지 즉시 적용용) */
  onGenerated?: (dataUrl: string) => void;
};

type GenerateResult = {
  base64: string;
  seed: number;
};

export default function ImageGenModal({ open, onClose, defaultPrompt = "", onGenerated }: Props) {
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

  async function handleGenerate() {
    if (!prompt.trim()) { setErrorMsg("프롬프트를 입력해주세요."); return; }
    setErrorMsg(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/generate/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), negativePrompt: negativePrompt.trim() || undefined, width, height, steps, cfgScale }),
      });
      const data = await res.json() as { base64?: string; seed?: number; error?: string };
      if (!res.ok) { setErrorMsg(data.error ?? "이미지 생성에 실패했습니다."); return; }
      const r: GenerateResult = { base64: data.base64 ?? "", seed: data.seed ?? 0 };
      setResult(r);
      if (onGenerated && r.base64) onGenerated(r.base64);
    } catch {
      setErrorMsg("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

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
      <div className="fixed inset-0 bg-black/60 z-40" onClick={onClose} aria-hidden="true" />

      {/* 모달 */}
      <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 z-50 max-w-lg mx-auto bg-bg2 border border-bg3 rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh]">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-bg3">
          <h2 className="text-sm font-semibold text-t1">AI 이미지 생성</h2>
          <button type="button" onClick={onClose}
            className="w-8 h-8 flex items-center justify-center text-t2 hover:text-t1 rounded-lg hover:bg-bg3 transition-colors" aria-label="닫기">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* 바디 */}
        <div className="p-5 flex flex-col gap-4">
          {/* 프롬프트 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-t1">프롬프트</label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={3}
              placeholder="생성할 이미지를 영어로 설명하세요"
              className="bg-bg border border-bg3 focus:border-red/50 rounded-lg px-3 py-2 text-sm text-t1 placeholder:text-t2 outline-none resize-none transition-colors"
            />
          </div>

          {/* 네거티브 프롬프트 */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-t1">네거티브 프롬프트</label>
            <textarea
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              rows={2}
              placeholder="생성 시 제외할 요소 (선택)"
              className="bg-bg border border-bg3 focus:border-red/50 rounded-lg px-3 py-2 text-sm text-t1 placeholder:text-t2 outline-none resize-none transition-colors"
            />
          </div>

          {/* 크기 선택 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-t1">너비</label>
              <select value={width} onChange={(e) => setWidth(Number(e.target.value))}
                className="bg-bg border border-bg3 focus:border-red/50 rounded-lg px-3 py-2 text-sm text-t1 outline-none transition-colors">
                {[256,512,640,768,1024].map((v) => <option key={v} value={v}>{v}px</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-t1">높이</label>
              <select value={height} onChange={(e) => setHeight(Number(e.target.value))}
                className="bg-bg border border-bg3 focus:border-red/50 rounded-lg px-3 py-2 text-sm text-t1 outline-none transition-colors">
                {[256,512,640,768,1024].map((v) => <option key={v} value={v}>{v}px</option>)}
              </select>
            </div>
          </div>

          {/* 스텝 / CFG Scale */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-t1">스텝: {steps}</label>
              <input type="range" min={10} max={50} value={steps}
                onChange={(e) => setSteps(Number(e.target.value))}
                className="accent-red" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-t1">CFG Scale: {cfgScale}</label>
              <input type="range" min={1} max={20} value={cfgScale}
                onChange={(e) => setCfgScale(Number(e.target.value))}
                className="accent-red" />
            </div>
          </div>

          {/* 에러 */}
          {errorMsg && (
            <div className="px-3 py-2 bg-red/10 border border-red/30 rounded-lg text-red text-xs">
              {errorMsg}
            </div>
          )}

          {/* 결과 이미지 */}
          {result && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-t2">Seed: {result.seed}</p>
              <div className="relative w-full aspect-square rounded-lg overflow-hidden border border-bg3">
                <Image src={result.base64} alt="생성된 이미지" fill className="object-contain" unoptimized />
              </div>
              <button type="button" onClick={handleDownload}
                className="w-full py-2 border border-bg3 hover:border-t2/50 text-t2 hover:text-t1 text-sm rounded-lg transition-colors">
                다운로드
              </button>
            </div>
          )}

          {/* 생성 버튼 */}
          <button type="button" onClick={handleGenerate} disabled={loading}
            className="w-full bg-red hover:bg-red/80 disabled:bg-red/40 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
            {loading ? "생성 중..." : "이미지 생성"}
          </button>
        </div>
      </div>
    </>
  );
}
