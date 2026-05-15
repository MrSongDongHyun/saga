// app/api/admin/stats/route.ts 테스트
// GET /api/admin/stats — 관리자 통계 API 검증
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "@/app/api/admin/stats/route";
import { NextRequest } from "next/server";
import { getTestPrisma } from "../setup";
import bcrypt from "bcryptjs";

// auth() 모킹 — NextAuth 실제 호출 차단
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
const mockAuth = auth as ReturnType<typeof vi.fn>;

function makeStatsRequest(): NextRequest {
  return new NextRequest("http://localhost/api/admin/stats");
}

// 테스트용 사용자 생성 헬퍼
async function createTestUser(
  overrides: Partial<{
    loginId: string;
    password: string;
    nickname: string;
    role: string;
    createdAt: Date;
  }> = {}
) {
  const prisma = getTestPrisma();
  const hashedPassword = await bcrypt.hash("testpass", 4); // 빠른 해시(cost=4)

  return prisma.user.create({
    data: {
      loginId: overrides.loginId ?? `user_${Date.now()}_${Math.random()}`,
      password: hashedPassword,
      nickname: overrides.nickname ?? `nick_${Date.now()}_${Math.random()}`,
      role: overrides.role ?? "USER",
      createdAt: overrides.createdAt,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/admin/stats", () => {
  // ── 인증/권한 검증 ─────────────────────────────────────
  it("미인증 → 401", async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET(makeStatsRequest());

    expect(res.status).toBe(401);
  });

  it("USER role → 403", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "user-123", role: "USER" },
    });

    const res = await GET(makeStatsRequest());

    expect(res.status).toBe(403);
  });

  // ── 정상 케이스 ───────────────────────────────────────
  it("ADMIN role → 200 + 5개 필드 모두 number 타입", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "admin-001", role: "ADMIN" },
    });

    const res = await GET(makeStatsRequest());

    expect(res.status).toBe(200);
    const body = await res.json();

    // 5개 필드 존재 확인
    expect(body).toHaveProperty("totalUsers");
    expect(body).toHaveProperty("totalStories");
    expect(body).toHaveProperty("totalCharacters");
    expect(body).toHaveProperty("totalChatSessions");
    expect(body).toHaveProperty("todayUsers");

    // 모두 number 타입
    expect(typeof body.totalUsers).toBe("number");
    expect(typeof body.totalStories).toBe("number");
    expect(typeof body.totalCharacters).toBe("number");
    expect(typeof body.totalChatSessions).toBe("number");
    expect(typeof body.todayUsers).toBe("number");
  });

  // ── 카운트 정확도 ─────────────────────────────────────
  it("user 3명 생성 후 totalUsers=3", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "admin-001", role: "ADMIN" },
    });

    // 3명 생성
    await createTestUser({ loginId: "countuser1", nickname: "count닉1" });
    await createTestUser({ loginId: "countuser2", nickname: "count닉2" });
    await createTestUser({ loginId: "countuser3", nickname: "count닉3" });

    const res = await GET(makeStatsRequest());
    const body = await res.json();

    expect(body.totalUsers).toBe(3);
  });

  it("빈 DB → 모든 카운트가 0", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "admin-001", role: "ADMIN" },
    });

    const res = await GET(makeStatsRequest());
    const body = await res.json();

    expect(body.totalUsers).toBe(0);
    expect(body.totalStories).toBe(0);
    expect(body.totalCharacters).toBe(0);
    expect(body.totalChatSessions).toBe(0);
    expect(body.todayUsers).toBe(0);
  });

  // ── todayUsers KST 기준 검증 ──────────────────────────
  it("오늘 가입자 1명 + 어제 가입자 1명 → todayUsers=1", async () => {
    mockAuth.mockResolvedValueOnce({
      user: { id: "admin-001", role: "ADMIN" },
    });

    // 어제 날짜 계산
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    // 어제 가입자 (createdAt을 어제로 직접 설정)
    // Prisma는 create 후 update로 날짜 조작
    const oldUser = await createTestUser({
      loginId: "olduser001",
      nickname: "어제가입자",
    });
    // 어제 날짜로 update
    await getTestPrisma().user.update({
      where: { id: oldUser.id },
      data: { createdAt: yesterday },
    });

    // 오늘 가입자
    await createTestUser({ loginId: "newuser001", nickname: "오늘가입자" });

    const res = await GET(makeStatsRequest());
    const body = await res.json();

    // todayUsers는 1 (오늘 가입자만)
    expect(body.todayUsers).toBe(1);
    // totalUsers는 2
    expect(body.totalUsers).toBe(2);
  });
});
