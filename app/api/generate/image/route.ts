// 이미지 생성 API
// POST /api/generate/image
// body: { prompt, negativePrompt?, width?, height?, steps?, cfgScale?, seed? }
import { NextRequest, NextResponse } from "next/server";
import { withHandler } from "@/lib/api-handler";
import { requireAuth } from "@/lib/rbac";
import { txt2img, checkSdHealth } from "@/lib/ai/sdwebui";

type GenerateImageBody = {
  prompt?: unknown;
  negativePrompt?: unknown;
  width?: unknown;
  height?: unknown;
  steps?: unknown;
  cfgScale?: unknown;
  seed?: unknown;
};

export const POST = withHandler(async (req: NextRequest) => {
  // 인증 필요
  await requireAuth();

  let body: GenerateImageBody;
  try {
    body = (await req.json()) as GenerateImageBody;
  } catch {
    return NextResponse.json(
      { error: "요청 본문을 파싱할 수 없습니다." },
      { status: 400 }
    );
  }

  if (typeof body.prompt !== "string" || body.prompt.trim().length === 0) {
    return NextResponse.json(
      { error: "프롬프트를 입력해주세요." },
      { status: 400 }
    );
  }

  // SD WebUI 가용 여부 확인
  const healthy = await checkSdHealth();
  if (!healthy) {
    return NextResponse.json(
      {
        error:
          "이미지 생성 서버에 연결할 수 없습니다. Stable Diffusion WebUI(:7860)가 실행 중인지 확인해주세요.",
      },
      { status: 503 }
    );
  }

  // 파라미터 검증 (범위 제한)
  const width = typeof body.width === "number" ? Math.min(1024, Math.max(256, body.width)) : 512;
  const height = typeof body.height === "number" ? Math.min(1024, Math.max(256, body.height)) : 512;
  const steps = typeof body.steps === "number" ? Math.min(50, Math.max(1, body.steps)) : 20;
  const cfgScale = typeof body.cfgScale === "number" ? Math.min(20, Math.max(1, body.cfgScale)) : 7;
  const seed = typeof body.seed === "number" ? body.seed : -1;
  const negativePrompt = typeof body.negativePrompt === "string" ? body.negativePrompt : undefined;

  try {
    const result = await txt2img({
      prompt: body.prompt.trim(),
      negativePrompt,
      width,
      height,
      steps,
      cfgScale,
      seed,
    });

    return NextResponse.json({
      base64: result.base64,
      seed: result.seed,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    console.error("[generate/image] txt2img 오류:", err);
    return NextResponse.json(
      { error: "이미지 생성에 실패했습니다.", detail: message },
      { status: 502 }
    );
  }
});
