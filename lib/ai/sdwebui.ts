// Stable Diffusion WebUI (AUTOMATIC1111) API 연동 유틸
// 기본 엔드포인트: http://localhost:7860
// POST /sdapi/v1/txt2img

const SD_BASE_URL = process.env.SD_WEBUI_URL ?? "http://localhost:7860";

export type Txt2ImgParams = {
  prompt: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfgScale?: number;
  seed?: number;
  samplerName?: string;
};

export type Txt2ImgResult = {
  base64: string;   // PNG base64 (data:image/png;base64,...)
  seed: number;
  info: string;
};

type SdApiResponse = {
  images: string[];
  parameters: Record<string, unknown>;
  info: string;
};

// ─────────────────────────────────────────────
// txt2img 호출
// ─────────────────────────────────────────────
export async function txt2img(params: Txt2ImgParams): Promise<Txt2ImgResult> {
  const body = {
    prompt: params.prompt,
    negative_prompt: params.negativePrompt ?? "lowres, bad anatomy, bad hands, text, error, blurry",
    width: params.width ?? 512,
    height: params.height ?? 512,
    steps: params.steps ?? 20,
    cfg_scale: params.cfgScale ?? 7,
    seed: params.seed ?? -1,
    sampler_name: params.samplerName ?? "DPM++ 2M Karras",
  };

  const res = await fetch(`${SD_BASE_URL}/sdapi/v1/txt2img`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`SD WebUI 오류 (${res.status}): ${text}`);
  }

  const data: SdApiResponse = await res.json();
  const raw = data.images[0];

  // info 에서 seed 추출
  let seed = -1;
  try {
    const info = JSON.parse(data.info) as Record<string, unknown>;
    if (typeof info.seed === "number") seed = info.seed;
  } catch {
    // 무시
  }

  return {
    base64: `data:image/png;base64,${raw}`,
    seed,
    info: data.info,
  };
}

// ─────────────────────────────────────────────
// SD WebUI 연결 확인
// ─────────────────────────────────────────────
export async function checkSdHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${SD_BASE_URL}/sdapi/v1/options`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
