// 캐릭터 목록 조회 / 생성 API
// GET  /api/characters  — 공개 목록 조회 (인증 불필요)
// POST /api/characters  — 캐릭터 생성 (로그인 필요)
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withHandler } from "@/lib/api-handler";
import { requireAuth } from "@/lib/rbac";
import { validateCharacterCreate } from "@/lib/validators/character";
import {
  serializeCharacterList,
  serializeCharacterDetail,
  characterDetailInclude,
  CharacterWithCountAndCreator,
  CharacterWithFullRelations,
} from "@/lib/serializers/character";

// ─────────────────────────────────────────────
// GET /api/characters
// ─────────────────────────────────────────────
export const GET = withHandler(async (req: NextRequest) => {
  const { searchParams } = req.nextUrl;

  // 페이지네이션
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limitRaw = parseInt(searchParams.get("limit") ?? "20", 10) || 20;
  const limit = Math.min(50, Math.max(1, limitRaw));
  const skip = (page - 1) * limit;

  // 필터 파라미터
  const qParam = searchParams.get("q");
  const sortParam = searchParams.get("sort"); // "latest" | "popular"

  // WHERE 조건 구성 (visibility는 항상 PUBLIC 고정)
  const where: Prisma.CharacterWhereInput = {
    visibility: "PUBLIC",
  };

  // 이름 검색
  if (qParam) {
    where.name = { contains: qParam };
  }

  // 정렬 — popular: 채팅 세션 수 내림차순, latest(기본): 최신순
  const orderBy: Prisma.CharacterOrderByWithRelationInput =
    sortParam === "popular"
      ? { chatSessions: { _count: "desc" } }
      : { createdAt: "desc" };

  // 목록 + 전체 카운트 병렬 조회
  const [characters, total] = await Promise.all([
    prisma.character.findMany({
      where,
      orderBy,
      skip,
      take: limit,
      include: {
        creator: {
          select: {
            id: true,
            nickname: true,
            profileImage: true,
          },
        },
        _count: {
          select: {
            chatSessions: true,
          },
        },
      },
    }),
    prisma.character.count({ where }),
  ]);

  return NextResponse.json({
    characters: (characters as CharacterWithCountAndCreator[]).map(
      serializeCharacterList
    ),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

// ─────────────────────────────────────────────
// POST /api/characters
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
  const input = validateCharacterCreate(body);

  // tags → JSON 문자열로 저장
  try {
    const created = await prisma.character.create({
      data: {
        name: input.name,
        description: input.description,
        personality: input.personality,
        backgroundStory: input.backgroundStory,
        firstMessage: input.firstMessage,
        avatar: input.avatar,
        tags: JSON.stringify(input.tags),
        visibility: input.visibility,
        creatorId: user.id,
      },
      include: characterDetailInclude,
    });

    return NextResponse.json(
      serializeCharacterDetail(created as CharacterWithFullRelations),
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
