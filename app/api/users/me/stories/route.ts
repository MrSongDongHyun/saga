// 내 스토리 목록 API
// GET /api/users/me/stories — 현재 로그인 사용자의 스토리 전체 (visibility 무관)
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withHandler } from "@/lib/api-handler";
import { requireAuth } from "@/lib/rbac";
import {
  serializeStoryList,
  storyListInclude,
  StoryWithCountAndAuthor,
} from "@/lib/serializers/story";

export const GET = withHandler(async (req: NextRequest) => {
  // 인증 필수
  const user = await requireAuth();

  const { searchParams } = req.nextUrl;

  // 페이지네이션
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limitRaw = parseInt(searchParams.get("limit") ?? "20", 10) || 20;
  const limit = Math.min(50, Math.max(1, limitRaw));
  const skip = (page - 1) * limit;

  // 현재 사용자의 스토리만 조회 (visibility 무관)
  const [stories, total] = await Promise.all([
    prisma.story.findMany({
      where: { authorId: user.id },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: storyListInclude,
    }),
    prisma.story.count({ where: { authorId: user.id } }),
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
