// API Route Wrapper
// Response throw는 그대로 반환, 일반 Error는 500 JSON으로 변환
import { NextRequest, NextResponse } from "next/server";

type RouteHandler = (req: NextRequest) => Promise<Response>;

type DynamicRouteHandler<T extends Record<string, string>> = (
  req: NextRequest,
  context: { params: Promise<T> }
) => Promise<Response>;

/**
 * API Route 핸들러 래퍼 (정적 라우트용)
 * - requireAuth/requireAdmin에서 throw된 Response 객체를 그대로 반환
 * - 예상치 못한 Error는 500 JSON으로 변환
 */
export function withHandler(handler: RouteHandler): RouteHandler {
  return async (req: NextRequest) => {
    try {
      return await handler(req);
    } catch (err) {
      // requireAuth / requireAdmin 에서 throw된 Response 그대로 반환
      if (err instanceof Response) {
        return err;
      }

      // 예상치 못한 서버 오류 — err.message는 서버 로그에만 남기고
      // 응답 바디에는 고정 메시지만 반환하여 내부 정보 노출 방지
      console.error("[api-handler] 예외:", err);

      return NextResponse.json(
        { error: "서버 내부 오류가 발생했습니다." },
        { status: 500 }
      );
    }
  };
}

/**
 * 동적 라우트([id], [id]/sub 등) 핸들러 래퍼
 * - requireAuth / requireOwnerOrAdmin에서 throw된 Response 그대로 반환
 * - validate*에서 throw된 NextResponse 그대로 반환
 * - 예상치 못한 Error는 500 JSON으로 변환
 */
export function withDynamicHandler<T extends Record<string, string>>(
  handler: DynamicRouteHandler<T>
): DynamicRouteHandler<T> {
  return async (req, context) => {
    try {
      return await handler(req, context);
    } catch (err) {
      if (err instanceof Response) return err;
      if (err instanceof NextResponse) return err;
      console.error("[api-handler] 예외:", err);
      return NextResponse.json(
        { error: "서버 내부 오류가 발생했습니다." },
        { status: 500 }
      );
    }
  };
}

/**
 * 스토리 존재 여부 확인 헬퍼 (like/bookmark 라우트 공용)
 */
export async function assertStoryExists(storyId: string): Promise<boolean> {
  const { prisma } = await import("@/lib/prisma");
  const story = await prisma.story.findUnique({
    where: { id: storyId },
    select: { id: true },
  });
  return story !== null;
}
