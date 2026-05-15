// RBAC (역할 기반 접근 제어) 유틸리티
// API Route에서 인증/권한 체크에 사용
import { auth } from "@/lib/auth";

/** 인증된 사용자 정보 타입 */
export type AuthUser = {
  id: string;
  role: "USER" | "ADMIN";
};

/**
 * 로그인 여부 검증
 * 미인증 시 401 Response를 throw
 */
export async function requireAuth(): Promise<AuthUser> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Response("Unauthorized", { status: 401 });
  }

  return {
    id: session.user.id,
    role: session.user.role ?? "USER",
  };
}

/**
 * 관리자(ADMIN) 권한 검증
 * 미인증 시 401, USER 역할이면 403 throw
 */
export async function requireAdmin(): Promise<AuthUser> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Response("Unauthorized", { status: 401 });
  }

  if (session.user.role !== "ADMIN") {
    throw new Response("Forbidden", { status: 403 });
  }

  return {
    id: session.user.id,
    role: "ADMIN",
  };
}

/**
 * 리소스 소유자 또는 관리자 권한 검증
 * 본인이 아니고 ADMIN도 아니면 403 throw
 *
 * @param ownerId     리소스 소유자 ID
 * @param requesterId 요청자 ID
 * @param role        요청자 역할
 */
export function requireOwnerOrAdmin(
  ownerId: string,
  requesterId: string,
  role: "USER" | "ADMIN"
): void {
  if (role === "ADMIN") return;
  if (ownerId === requesterId) return;

  throw new Response("Forbidden", { status: 403 });
}
