// app/api/auth/register/route.ts 테스트
// POST /api/auth/register — 회원가입 API 검증
import { describe, it, expect, beforeEach } from "vitest";
import { POST } from "@/app/api/auth/register/route";
import { NextRequest } from "next/server";
import { getTestPrisma } from "../setup";

// NextRequest 생성 헬퍼
function makeRegisterRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/register", () => {
  // ── 정상 케이스 ───────────────────────────────────────
  it("유효한 입력 → 201 + { id } 반환", async () => {
    const req = makeRegisterRequest({
      loginId: "testuser1",
      password: "password123",
      nickname: "테스터",
    });

    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(typeof body.id).toBe("string");
  });

  it("정상 가입 후 DB에 사용자가 존재한다", async () => {
    const prisma = getTestPrisma();

    const req = makeRegisterRequest({
      loginId: "dbcheck01",
      password: "securepass",
      nickname: "디비체커",
    });

    await POST(req);

    const user = await prisma.user.findUnique({ where: { loginId: "dbcheck01" } });
    expect(user).not.toBeNull();
    expect(user!.nickname).toBe("디비체커");
  });

  it("정상 가입 후 DB의 password가 bcrypt 해시 형태이다", async () => {
    const prisma = getTestPrisma();

    const req = makeRegisterRequest({
      loginId: "hashtest1",
      password: "plaintext",
      nickname: "해시테스터",
    });

    await POST(req);

    const user = await prisma.user.findUnique({ where: { loginId: "hashtest1" } });
    expect(user).not.toBeNull();
    // bcrypt 해시는 $2a$ 또는 $2b$로 시작
    expect(user!.password).toMatch(/^\$2[ab]\$/);
  });

  it("정상 가입 시 role이 USER이다", async () => {
    const prisma = getTestPrisma();

    const req = makeRegisterRequest({
      loginId: "roletest1",
      password: "password1",
      nickname: "롤테스터",
    });

    await POST(req);

    const user = await prisma.user.findUnique({ where: { loginId: "roletest1" } });
    expect(user!.role).toBe("USER");
  });

  // ── loginId 검증 ──────────────────────────────────────
  it("loginId 3자 → 400, field: loginId", async () => {
    const req = makeRegisterRequest({
      loginId: "abc",  // 3자 (최소 4자)
      password: "password123",
      nickname: "닉네임1",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.field).toBe("loginId");
  });

  it("loginId 21자 → 400, field: loginId", async () => {
    const req = makeRegisterRequest({
      loginId: "a".repeat(21),  // 21자 (최대 20자)
      password: "password123",
      nickname: "닉네임2",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.field).toBe("loginId");
  });

  it("loginId 특수문자 포함 → 400, field: loginId", async () => {
    const req = makeRegisterRequest({
      loginId: "user@name",  // 특수문자 포함
      password: "password123",
      nickname: "닉네임3",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.field).toBe("loginId");
  });

  // ── password 검증 ─────────────────────────────────────
  it("password 5자 → 400, field: password", async () => {
    const req = makeRegisterRequest({
      loginId: "validuser",
      password: "12345",  // 5자 (최소 6자)
      nickname: "닉네임4",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.field).toBe("password");
  });

  // ── nickname 검증 ─────────────────────────────────────
  it("nickname 1자 → 400, field: nickname", async () => {
    const req = makeRegisterRequest({
      loginId: "validuser",
      password: "password123",
      nickname: "닉",  // 1자 (최소 2자)
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.field).toBe("nickname");
  });

  it("nickname 16자 → 400, field: nickname", async () => {
    const req = makeRegisterRequest({
      loginId: "validuser",
      password: "password123",
      nickname: "닉".repeat(16),  // 16자 (최대 15자)
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.field).toBe("nickname");
  });

  // ── 중복 검증 ─────────────────────────────────────────
  it("중복 loginId → 400, field: loginId, 명확한 메시지", async () => {
    // 먼저 가입
    const req1 = makeRegisterRequest({
      loginId: "duplicateid",
      password: "password123",
      nickname: "첫번째닉",
    });
    await POST(req1);

    // 같은 loginId로 재시도
    const req2 = makeRegisterRequest({
      loginId: "duplicateid",
      password: "otherpass",
      nickname: "두번째닉",
    });

    const res = await POST(req2);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.field).toBe("loginId");
    expect(body.error).toContain("아이디");
  });

  it("중복 nickname → 400, field: nickname, 명확한 메시지", async () => {
    // 먼저 가입
    const req1 = makeRegisterRequest({
      loginId: "firstuser1",
      password: "password123",
      nickname: "중복닉네임",
    });
    await POST(req1);

    // 같은 nickname으로 재시도
    const req2 = makeRegisterRequest({
      loginId: "seconduser",
      password: "otherpass",
      nickname: "중복닉네임",
    });

    const res = await POST(req2);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.field).toBe("nickname");
    expect(body.error).toContain("닉네임");
  });

  // ── 잘못된 요청 바디 ──────────────────────────────────
  it("JSON이 아닌 바디 → 400", async () => {
    const req = new NextRequest("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });
});
