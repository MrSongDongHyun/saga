// POST /api/stories/:id/media/generate
// 한국어 프롬프트 → Claude 번역 → SD 이미지 생성 → public/media 저장 → DB 기록
import { NextRequest, NextResponse } from "next/server";
import { withDynamicHandler } from "@/lib/api-handler";
import { requireAuth } from "@/lib/rbac";
import { prisma } from "@/lib/prisma";
import { generateAndSaveImage } from "@/lib/ai/imageGen";
import { checkSdHealth } from "@/lib/ai/sdwebui";

export const POST = withDynamicHandler(async (req: NextRequest, context) => {
  const { id } = await context.params;
  const user = await requireAuth();

  const story = await prisma.story.findUnique({
    where: { id },
    select: { authorId: true },
  });

  if (!story) {
    return NextResponse.json({ error: "스토리를 찾을 수 없습니다." }, { status: 404 });
  }
  if (story.authorId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  const sdAlive = await checkSdHealth();
  if (!sdAlive) {
    return NextResponse.json(
      { error: "Stable Diffusion 서버에 연결할 수 없습니다. (http://localhost:7860)" },
      { status: 503 }
    );
  }

  const body = await req.json() as {
    category: string;
    situation: string;
    prompt: string;
    width?: number;
    height?: number;
    negativePrompt?: string;
  };

  const { category, situation, prompt } = body;
  if (!category?.trim() || !situation?.trim() || !prompt?.trim()) {
    return NextResponse.json(
      { error: "category, situation, prompt 는 필수 항목입니다." },
      { status: 400 }
    );
  }

  if (category.length > 20 || situation.length > 20) {
    return NextResponse.json(
      { error: "category, situation 은 최대 20자입니다." },
      { status: 400 }
    );
  }

  const media = await generateAndSaveImage({
    storyId: id,
    category: category.trim(),
    situation: situation.trim(),
    koreanPrompt: prompt.trim(),
    width: body.width,
    height: body.height,
    negativePrompt: body.negativePrompt,
  });

  return NextResponse.json(media, { status: 201 });
});
