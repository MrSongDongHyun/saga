// 내 북마크 목록 조회 API
// GET /api/users/me/bookmarks — 로그인 사용자의 북마크 스토리 목록
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import {
  serializeStoryList,
  StoryListItem,
  storyListInclude,
} from "@/lib/serializers/story";

// ─────────────────────────────────────────────
// 응답 타입
// ─────────────────────────────────────────────
type BookmarkItem = {
  id: string;        // Bookmark.id
  storyId: string;
  createdAt: string;
  story: StoryListItem;
};

type BookmarksResponse = {
  bookmarks: BookmarkItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

// ─────────────────────────────────────────────
// GET /api/users/me/bookmarks
// ─────────────────────────────────────────────
export async function GET(req: NextRequest): Promise<Response> {
  try {
    // 인증 필수
    const user = await requireAuth();

    // 쿼리 파라미터 파싱
    const { searchParams } = req.nextUrl;
    const rawPage = parseInt(searchParams.get("page") ?? "1", 10);
    const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);

    // 값 검증 및 범위 제한
    const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(rawLimit, 50) // 최대 50
        : 20;

    const skip = (page - 1) * limit;

    // 전체 북마크 수 + 목록 병렬 조회
    const [total, bookmarkRows] = await Promise.all([
      prisma.bookmark.count({ where: { userId: user.id } }),
      prisma.bookmark.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          storyId: true,
          createdAt: true,
          story: {
            include: storyListInclude,
          },
        },
      }),
    ]);

    const bookmarks: BookmarkItem[] = bookmarkRows.map((row) => ({
      id: row.id,
      storyId: row.storyId,
      createdAt: row.createdAt.toISOString(),
      story: serializeStoryList(row.story),
    }));

    const totalPages = Math.ceil(total / limit);

    const response: BookmarksResponse = {
      bookmarks,
      pagination: { page, limit, total, totalPages },
    };

    return NextResponse.json(response);
  } catch (err) {
    // requireAuth 에서 throw된 Response 그대로 반환
    if (err instanceof Response) {
      return err;
    }
    if (err instanceof NextResponse) {
      return err;
    }
    console.error("[api/users/me/bookmarks] 예외:", err);
    return NextResponse.json(
      { error: "서버 내부 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
