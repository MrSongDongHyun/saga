// lib/rbac.ts 테스트
// requireAuth / requireAdmin / requireOwnerOrAdmin 검증
import { describe, it, expect, vi, beforeEach } from "vitest";
import { requireAuth, requireAdmin, requireOwnerOrAdmin } from "@/lib/rbac";

// auth() 함수 모킹 — NextAuth 실제 호출 차단
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
const mockAuth = auth as ReturnType<typeof vi.fn>;

// ── 헬퍼: 세션 객체 생성 ──────────────────────────────
function makeSession(id: string, role: "USER" | "ADMIN") {
  return { user: { id, role } };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────
// A-1. requireAuth
// ─────────────────────────────────────────────────────
describe("requireAuth", () => {
  it("세션 없을 때 401 Response를 throw한다", async () => {
    mockAuth.mockResolvedValueOnce(null);

    let thrown: unknown;
    try {
      await requireAuth();
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(401);
  });

  it("user.id가 없을 때 401 Response를 throw한다", async () => {
    mockAuth.mockResolvedValueOnce({ user: {} });

    let thrown: unknown;
    try {
      await requireAuth();
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(401);
  });

  it("유효한 세션이 있으면 AuthUser를 반환한다", async () => {
    mockAuth.mockResolvedValueOnce(makeSession("user-123", "USER"));

    const user = await requireAuth();

    expect(user).toEqual({ id: "user-123", role: "USER" });
  });

  it("role이 없을 때 기본값 USER로 반환한다", async () => {
    // role 필드 없는 세션
    mockAuth.mockResolvedValueOnce({ user: { id: "user-456" } });

    const user = await requireAuth();

    expect(user.id).toBe("user-456");
    expect(user.role).toBe("USER");
  });

  it("ADMIN 세션이면 ADMIN AuthUser를 반환한다", async () => {
    mockAuth.mockResolvedValueOnce(makeSession("admin-001", "ADMIN"));

    const user = await requireAuth();

    expect(user).toEqual({ id: "admin-001", role: "ADMIN" });
  });
});

// ─────────────────────────────────────────────────────
// A-2. requireAdmin
// ─────────────────────────────────────────────────────
describe("requireAdmin", () => {
  it("세션 없을 때 401 Response를 throw한다", async () => {
    mockAuth.mockResolvedValueOnce(null);

    let thrown: unknown;
    try {
      await requireAdmin();
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(401);
  });

  it("USER role일 때 403 Response를 throw한다", async () => {
    mockAuth.mockResolvedValueOnce(makeSession("user-123", "USER"));

    let thrown: unknown;
    try {
      await requireAdmin();
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(403);
  });

  it("ADMIN role이면 AuthUser를 반환한다", async () => {
    mockAuth.mockResolvedValueOnce(makeSession("admin-001", "ADMIN"));

    const user = await requireAdmin();

    expect(user).toEqual({ id: "admin-001", role: "ADMIN" });
  });
});

// ─────────────────────────────────────────────────────
// A-3. requireOwnerOrAdmin (동기 함수)
// ─────────────────────────────────────────────────────
describe("requireOwnerOrAdmin", () => {
  it("ADMIN은 ownerId와 무관하게 통과한다", () => {
    // throw가 없으면 성공
    expect(() =>
      requireOwnerOrAdmin("owner-999", "admin-001", "ADMIN")
    ).not.toThrow();
  });

  it("USER가 본인 리소스면 통과한다", () => {
    expect(() =>
      requireOwnerOrAdmin("user-123", "user-123", "USER")
    ).not.toThrow();
  });

  it("USER가 타인 리소스면 403 Response를 throw한다", () => {
    let thrown: unknown;
    try {
      requireOwnerOrAdmin("user-999", "user-123", "USER");
    } catch (e) {
      thrown = e;
    }

    expect(thrown).toBeInstanceOf(Response);
    expect((thrown as Response).status).toBe(403);
  });
});
