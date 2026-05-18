// POST /api/ai/story-profile
// 장르를 받아 AI로 스토리 제목 + 한 줄 소개를 생성
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/rbac";
import { askClaude } from "@/lib/ai/claude";

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
  } catch (e) {
    return e as Response;
  }

  let genre = "판타지";
  try {
    const body = (await req.json()) as { genre?: string };
    if (body.genre) genre = body.genre;
  } catch { /* ignore */ }

  const system = `당신은 창의적인 웹소설 제목과 소개 작가입니다.
JSON 형식으로만 응답합니다. 설명 없이 JSON만 출력하세요.`;

  const prompt = `장르: ${genre}
위 장르의 매력적인 웹소설 정보를 JSON으로 생성해주세요:
{
  "title": "30자 이내의 독창적인 제목",
  "summary": "100자 이내의 흥미로운 한 줄 소개"
}`;

  try {
    const raw = await askClaude(system, prompt);
    // JSON 파싱
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("JSON not found");
    const data = JSON.parse(match[0]) as { title: string; summary: string };
    return NextResponse.json({
      title: (data.title ?? "").slice(0, 50),
      summary: (data.summary ?? "").slice(0, 100),
    });
  } catch (err) {
    console.error("[story-profile]", err);
    return NextResponse.json({ error: "AI 생성에 실패했습니다." }, { status: 500 });
}
