// SD 이미지 base64 → public/media/{storyId}/ 파일 저장 유틸
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { randomBytes } from "crypto";

const MEDIA_ROOT = join(process.cwd(), "public", "media");

export type SavedImage = {
  filename: string;
  imageUrl: string;  // /media/{storyId}/{filename}
  fileSize: number;  // bytes
};

/**
 * base64 PNG 문자열을 public/media/{storyId}/ 에 저장하고 URL을 반환
 * @param base64 "data:image/png;base64,..." 또는 raw base64 문자열
 */
export async function saveMediaImage(
  base64: string,
  storyId: string
): Promise<SavedImage> {
  const raw = base64.startsWith("data:")
    ? base64.split(",")[1]
    : base64;

  const buffer = Buffer.from(raw, "base64");
  const filename = `${Date.now()}_${randomBytes(4).toString("hex")}.png`;
  const dir = join(MEDIA_ROOT, storyId);

  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, filename), buffer);

  return {
    filename,
    imageUrl: `/media/${storyId}/${filename}`,
    fileSize: buffer.byteLength,
  };
}
