// GET /api/sd/health — Stable Diffusion 서버 연결 상태 확인
import { NextResponse } from "next/server";
import { checkSdHealth } from "@/lib/ai/sdwebui";

export async function GET() {
  const alive = await checkSdHealth();
  return NextResponse.json(
    { ok: alive, url: process.env.SD_WEBUI_URL ?? "http://localhost:7860" },
    { status: alive ? 200 : 503 }
  );
}
