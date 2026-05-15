// 스토리 목록 조회 / 생성 API
// GET  /api/stories  — 공개 목록 조회 (인증 불필요)
// POST /api/stories  — 스토리 생성 (로그인 필요)
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withHandler } from "@/lib/api-handler";
import { requireAuth } from "@/lib/rbac";
import { validateStoryCreate } from "@/lib/validators/story";
import {
  serializeStoryList,
  serializeStoryDetail,
  storyDetailInclude,
  StoryWithCountAndAuthor,
  StoryWithFullRelations,
} from "@/lib/serializers/story";

// ─────────────────────────────────────────────
// 허용 상수 (GET 필터 파라미터 검증용)
// ─────────────────────────────────────────────
const ALLOWED_STATUSES = ["ONGOING", "COMPLETED", "HIATUS"] as const;

// ─────────────────────────────────────────────
// GET /api/stories
// ─────────────────────────────────────────────
export const GET = withHandler(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl;

  // 페이지네이션
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limitRaw = parseInt(searchParams.get("limit") ?? "20", 10) || 20;
  const limit = Math.min(50, Math.max(1, limitRaw));
  const skip = (page - 1) * limit;

  // 필터 파라미터
  const statusParam = searchParams.get("status");
  const genreParam = searchParams.get("genre");
  const qParam = searchParams.get("q");
  const sortParam = searchParams.get("sort"); // "latest" | "popular"

  // WHERE 조건 구성 (visibility는 항상 PUBLIC 고정)
  const where: Prisma.StoryWhereInput = {
    visibility: "PUBLIC",
  };

  if (statusParam) {
    // 허용된 status 값만 필터에 적용 (화이트리스트 검증)
    if (!ALLOWED_STATUSES.includes(statusParam as (typeof ALLOWED_STATUSES)[number])) {
      return NextResponse.json(
        { error: `status는 ${ALLOWED_STATUSES.join(", ")} 중 하나여야 합니다.`, field: "status" },
        { status: 400 }
      );
    }
    where.status = statusParam;
  }

  // genre LIKE 검색 — SQLite는 mode: insensitive 미지원이므로 contains만 사용
  if (genreParam) {
    where.genre = { contains: genreParam };
  }

  // 제목 검색
  if (qParam) {
    where.title = { contains: qParam };
  }

  // 정렬 — popular: 좋아요 수 내림차순, latest(기본): 최신순
  const orderBy: Prisma.StoryOrderByWithRelationInput =
    sortParam === "popular"
      ? { likes: { _count: "desc" } }
      : { createdAt: "desc" };

  // 목록 + 전체 카운트 병렬 조회
  const [stories, total] = await Promise.all([
    prisma.story.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        author: {
          select: {
            id: true,
            nickname: true,
            profileImage: true,
          },
        },
        _count: {
          select: {
            likes: true,
            bookmarks: true,
            chapters: true,
          },
        },
      },
    }),
    prisma.story.count({ where }),
  ]);

  return NextResponse.json({
    stories: (stories as StoryWithCountAndAuthor[]).map(serializeStoryList),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// ─────────────────────────────────────────────
// POST /api/stories
// ─────────────────────────────────────────────
export const POST = withHandler(async (req: NextRequest) => {
  // 인증 필수
  const user = await requireAuth();

  // 요청 바디 파싱
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "요청 본문을 파싱할 수 없습니다." },
      { status: 400 }
    );
  }

  // 유효성 검증 (실패 시 400 throw)
  const input = validateStoryCreate(body);

  // genre/tags → JSON 문자열로 저장
  try {
    const created = await prisma.story.create({
      data: {
        title: input.title,
        description: input.description,
        genre: JSON.stringify(input.genre),
        tags: JSON.stringify(input.tags),
        status: input.status,
        visibility: input.visibility,
        coverImage: input.coverImage,
        authorId: user.id,
      },
      include: storyDetailInclude,
    });

    return NextResponse.json(
      serializeStoryDetail(created as StoryWithFullRelations),
      { status: 201 }
    );
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "중복된 데이터가 존재합니다." },
        { status: 400 }
      );
    }
    throw err;
  }
});
