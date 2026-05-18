// GET  /api/stories/[id]/media  — 미디어 목록 조회
// POST /api/stories/[id]/media  — 이미지 업로드 (multipart/form-data)
import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { withDynamicHandler } from "@/lib/api-handler";

// 허용 MIME 타입
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

// 파일명에서 분류/상황 파싱: "분류_상황.ext" → { category, situation }
function parseFilename(filename: string): { category: string; situation: string } | null {
  const base = filename.replace(/\.[^.]+$/, ""); // 확장자 제거
  const parts = base.split("_");
  if (parts.length < 2) return null;
  const category = parts[0].trim();
  const situation = parts.slice(1).join("_").trim();
  if (!category || !situation) return null;
  return { category, situation };
}

// ─────────────────────────────────────────────
// GET /api/stories/[id]/media
// ─────────────────────────────────────────────
export const GET = withDynamicHandler(async (_req: NextRequest, context) => {
  const { id } = await context.params;

  const story = await prisma.story.findUnique({ where: { id }, select: { id: true } });
  if (!story) {
    return NextResponse.json({ error: "스토리를 찾을 수 없습니다." }, { status: 404 });
  }

  const mediaItems = await prisma.storyMedia.findMany({
    where: { storyId: id },
    orderBy: [{ category: "asc" }, { situation: "asc" }, { createdAt: "asc" }],
  });

  // 분류별 그룹화
  const grouped: Record<string, typeof mediaItems> = {};
  for (const item of mediaItems) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }

  return NextResponse.json({ mediaItems, grouped });
});

// ─────────────────────────────────────────────
// POST /api/stories/[id]/media
// ─────────────────────────────────────────────
export const POST = withDynamicHandler(async (req: NextRequest, context) => {
  const { id } = await context.params;
  const user = await requireAuth();

  const story = await prisma.story.findUnique({ where: { id }, select: { id: true, authorId: true } });
  if (!story) {
    return NextResponse.json({ error: "스토리를 찾을 수 없습니다." }, { status: 404 });
  }
  if (story.authorId !== user.id && user.role !== "ADMIN") {
    return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
  }

  // 최대 1000장 제한
  const count = await prisma.storyMedia.count({ where: { storyId: id } });
  if (count >= 1000) {
    return NextResponse.json({ error: "미디어는 최대 1000개까지 허용됩니다." }, { status: 400 });
  }

  // multipart/form-data 파싱
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "파일 업로드 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const categoryInput = formData.get("category") as string | null;
  const situationInput = formData.get("situation") as string | null;

  if (!file) {
    return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
  }

  // MIME 타입 확인
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json(
      { error: "JPG, PNG, WebP, GIF 형식만 업로드 가능합니다." },
      { status: 400 }
    );
  }

  // 파일 크기 확인
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "파일 크기는 5MB 이하여야 합니다." }, { status: 400 });
  }

  // 분류/상황: 폼 입력 우선, 없으면 파일명 파싱
  let category = categoryInput?.trim() ?? "";
  let situation = situationInput?.trim() ?? "";

  if (!category || !situation) {
    const parsed = parseFilename(file.name);
    if (parsed) {
      if (!category) category = parsed.category;
      if (!situation) situation = parsed.situation;
    }
  }

  if (!category || !situation) {
    return NextResponse.json(
      { error: "분류와 상황을 입력하거나 파일명을 '분류_상황.jpg' 형식으로 지정하세요." },
      { status: 400 }
    );
  }

  if (category.length > 20) {
    return NextResponse.json({ error: "분류는 최대 20자여야 합니다." }, { status: 400 });
  }
  if (situation.length > 20) {
    return NextResponse.json({ error: "상황은 최대 20자여야 합니다." }, { status: 400 });
  }
  // 슬래시는 SCENE_TAG 파싱 구분자이므로 금지
  if (category.includes("/") || category.includes("\\")) {
    return NextResponse.json({ error: "분류에 슬래시(/)를 사용할 수 없습니다." }, { status: 400 });
  }
  if (situation.includes("/") || situation.includes("\\")) {
    return NextResponse.json({ error: "상황에 슬래시(/)를 사용할 수 없습니다." }, { status: 400 });
  }

  // public/media/[storyId]/ 폴더에 저장
  const ext = file.name.split(".").pop() ?? "jpg";
  const timestamp = Date.now();
  const safeCategory = category.replace(/[^a-zA-Z0-9가-힣]/g, "");
  const safeSituation = situation.replace(/[^a-zA-Z0-9가-힣]/g, "");
  const savedFilename = `${safeCategory}_${safeSituation}_${timestamp}.${ext}`;

  const mediaDir = path.join(process.cwd(), "public", "media", id);
  if (!existsSync(mediaDir)) {
    await mkdir(mediaDir, { recursive: true });
  }

  const filePath = path.join(mediaDir, savedFilename);
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const imageUrl = `/media/${id}/${savedFilename}`;

  const created = await prisma.storyMedia.create({
    data: {
      storyId: id,
      category,
      situation,
      imageUrl,
      filename: file.name,
      fileSize: file.size,
    },
  });

  return NextResponse.json({ media: created }, { status: 201 });
});
