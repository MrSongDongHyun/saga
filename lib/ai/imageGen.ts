// 한국어 프롬프트 → 영어 SD 프롬프트 번역 + 이미지 생성 통합 유틸
import { askClaude } from "@/lib/ai/claude";
import { txt2img, type Txt2ImgParams } from "@/lib/ai/sdwebui";
import { saveMediaImage } from "@/lib/sdStorage";
import { prisma } from "@/lib/prisma";

const TRANSLATE_SYSTEM = `You are a Stable Diffusion prompt engineer.
Convert the Korean scene description into a concise English prompt for Stable Diffusion.
Rules:
- Output ONLY the English prompt tags, no explanation
- Use comma-separated descriptive tags
- Always include quality boosters: masterpiece, best quality, highly detailed
- Keep it under 150 tokens`;

/**
 * 한국어 장면 설명을 SD용 영어 프롬프트로 번역
 */
export async function translateToSdPrompt(koreanText: string): Promise<string> {
  const result = await askClaude(
    TRANSLATE_SYSTEM,
    `장면 설명: ${koreanText}`
  );
  return result.trim();
}

export type GenerateImageInput = {
  storyId: string;
  category: string;
  situation: string;
  koreanPrompt: string;
  width?: number;
  height?: number;
  negativePrompt?: string;
};

export type GeneratedMedia = {
  id: string;
  imageUrl: string;
  filename: string;
  fileSize: number;
  translatedPrompt: string;
};

/**
 * 한국어 프롬프트 → 번역 → SD 생성 → 파일 저장 → DB 기록
 */
export async function generateAndSaveImage(
  input: GenerateImageInput
): Promise<GeneratedMedia> {
  const { storyId, category, situation, koreanPrompt, width, height, negativePrompt } = input;

  // 1. 한국어 → 영어 SD 프롬프트
  const englishPrompt = await translateToSdPrompt(koreanPrompt);

  // 2. SD WebUI로 이미지 생성
  const params: Txt2ImgParams = {
    prompt: englishPrompt,
    negativePrompt,
    width: width ?? 512,
    height: height ?? 768,
    steps: 28,
    cfgScale: 7,
    samplerName: "DPM++ 2M Karras",
  };

  const result = await txt2img(params);

  // 3. public/media/{storyId}/ 에 저장
  const saved = await saveMediaImage(result.base64, storyId);

  // 4. DB에 StoryMedia 레코드 생성
  const media = await prisma.storyMedia.create({
    data: {
      storyId,
      category,
      situation,
      imageUrl: saved.imageUrl,
      filename: saved.filename,
      fileSize: saved.fileSize,
    },
  });

  return {
    id: media.id,
    imageUrl: saved.imageUrl,
    filename: saved.filename,
    fileSize: saved.fileSize,
    translatedPrompt: englishPrompt,
  };
}
