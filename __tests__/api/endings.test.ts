// app/api/stories/[id]/endings/route.ts 통합 테스트
// GET  /api/stories/[id]/endings      — 엔딩 목록 조회
// POST /api/stories/[id]/endings      — 엔딩 생성
// PUT  /api/stories/[id]/endings/[endingId]    — 엔딩 수정
// DELETE /api/stories/[id]/endings/[endingId] — 엔딩 삭제
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getTestPrisma } from "../setup";

// ── auth() 모킹 ────────────────────────────────────────────────
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
const mockAuth = auth as ReturnType<typeof vi.fn>;

// ── 라우트 핸들러 ──────────────────────────────────────────────
import {
  GET,
  POST,
} from "@/app/api/stories/[id]/endings/route";
import {
  PUT,
  DELETE,
} from "@/app/api/stories/[id]/endings/[endingId]/route";

// ─────────────────────────────────────────────
// 요청 생성 헬퍼
// ─────────────────────────────────────────────

function makeRequest(method: string, url: string, body?: unknown): NextRequest {
  return new NextRequest(url, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeContext(params: Record<string, string>) {
  return { params: Promise.resolve(params) };
}

// ─────────────────────────────────────────────
// DB 픽스처 헬퍼
// ─────────────────────────────────────────────

async function createUser(overrides: Partial<{ loginId: string; nickname: string; role: string }> = {}) {
  const prisma = getTestPrisma();
  return prisma.user.create({
    data: {
      loginId:  overrides.loginId  ?? `user_${Date.now()}_${Math.random()}`,
      password: "hashed_password",
      nickname: overrides.nickname ?? `nick_${Date.now()}_${Math.random()}`,
      role:     overrides.role     ?? "USER",
    },
  });
}

async function createStory(authorId: string, overrides: Partial<{ title: string; visibility: string }> = {}) {
  const prisma = getTestPrisma();
  return prisma.story.create({
    data: {
      title:      overrides.title      ?? `스토리_${Date.now()}_${Math.random()}`,
      genre:      '["판타지"]',
      tags:       "[]",
      status:     "ONGOING",
      visibility: overrides.visibility ?? "PUBLIC",
      authorId,
    },
  });
}

async function createStatDef(storyId: string, name = "우호도") {
  const prisma = getTestPrisma();
  return prisma.storyStatDef.create({
    data: {
      storyId,
      name,
      icon:       "heart",
      color:      "red",
      minVal:     0,
      maxVal:     100,
      defaultVal: 50,
      description: "테스트 스탯",
    },
  });
}

async function createEnding(storyId: string, overrides: Partial<{ name: string; grade: string }> = {}) {
  const prisma = getTestPrisma();
  return prisma.storyEnding.create({
    data: {
      storyId,
      name:     overrides.name  ?? `엔딩_${Date.now()}`,
      grade:    overrides.grade ?? "N",
      prompt:   "",
      minTurn:  10,
      startTurn: 10,
      sortOrder: 0,
    },
  });
}

// ─────────────────────────────────────────────
// beforeEach: mock 초기화
// ─────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue(null);
});

// ─────────────────────────────────────────────
// GET /api/stories/[id]/endings
// ─────────────────────────────────────────────
describe("GET /api/stories/[id]/endings", () => {
  it("존재하는 스토리 → 200, endings 배열 반환", async () => {
    const owner = await createUser({ loginId: "ge1", nickname: "게터1" });
    const story = await createStory(owner.id);
    await createEnding(story.id, { name: "행복한 엔딩", grade: "SSR" });
    await createEnding(story.id, { name: "슬픈 엔딩", grade: "N" });

    const req = makeRequest("GET", `http://localhost/api/stories/${story.id}/endings`);
    const res = await GET(req, makeContext({ id: story.id }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("endings");
    expect(Array.isArray(body.endings)).toBe(true);
    expect(body.endings).toHaveLength(2);
  });

  it("엔딩 없는 스토리 → 200, 빈 배열", async () => {
    const owner = await createUser({ loginId: "ge2", nickname: "게터2" });
    const story = await createStory(owner.id);

    const req = makeRequest("GET", `http://localhost/api/stories/${story.id}/endings`);
    const res = await GET(req, makeContext({ id: story.id }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.endings).toEqual([]);
  });

  it("존재하지 않는 스토리 → 404", async () => {
    const req = makeRequest("GET", "http://localhost/api/stories/nonexistent/endings");
    const res = await GET(req, makeContext({ id: "nonexistent" }));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("엔딩에 conditions 배열 포함", async () => {
    const owner = await createUser({ loginId: "ge3", nickname: "게터3" });
    const story = await createStory(owner.id);
    const statDef = await createStatDef(story.id);
    const ending = await createEnding(story.id, { name: "조건부 엔딩" });
    const prisma = getTestPrisma();
    await prisma.endingCondition.create({
      data: { endingId: ending.id, statDefId: statDef.id, operator: "gte", value: 80, groupId: 0 },
    });

    const req = makeRequest("GET", `http://localhost/api/stories/${story.id}/endings`);
    const res = await GET(req, makeContext({ id: story.id }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.endings[0].conditions).toHaveLength(1);
    expect(body.endings[0].conditions[0].operator).toBe("gte");
  });
});

// ─────────────────────────────────────────────
// POST /api/stories/[id]/endings
// ─────────────────────────────────────────────
describe("POST /api/stories/[id]/endings", () => {
  it("미인증 → 401", async () => {
    mockAuth.mockResolvedValue(null);
    const owner = await createUser({ loginId: "pe1", nickname: "포스터1" });
    const story = await createStory(owner.id);

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/endings`, {
      name: "새 엔딩",
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(401);
  });

  it("소유자 엔딩 생성 → 201, ending 포함 응답", async () => {
    const owner = await createUser({ loginId: "pe2", nickname: "포스터2" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/endings`, {
      name: "해피엔딩",
      grade: "SSR",
      prompt: "행복한 결말",
      epilogue: "그들은 행복하게 살았습니다.",
      minTurn: 20,
      startTurn: 20,
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("ending");
    expect(body.ending.name).toBe("해피엔딩");
    expect(body.ending.grade).toBe("SSR");
    expect(body.ending.storyId).toBe(story.id);
  });

  it("타인 스토리에 엔딩 생성 → 403", async () => {
    const owner = await createUser({ loginId: "pe3", nickname: "포스터3" });
    const other = await createUser({ loginId: "pe4", nickname: "포스터4" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: other.id, role: "USER" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/endings`, {
      name: "무단 엔딩",
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(403);
  });

  it("존재하지 않는 스토리 → 404", async () => {
    const user = await createUser({ loginId: "pe5", nickname: "포스터5" });
    mockAuth.mockResolvedValue({ user: { id: user.id, role: "USER" } });

    const req = makeRequest("POST", "http://localhost/api/stories/nonexistent/endings", {
      name: "없는 스토리 엔딩",
    });
    const res = await POST(req, makeContext({ id: "nonexistent" }));

    expect(res.status).toBe(404);
  });

  it("name 누락 → 400", async () => {
    const owner = await createUser({ loginId: "pe6", nickname: "포스터6" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/endings`, {
      grade: "N",
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(400);
  });

  it("잘못된 grade → 400", async () => {
    const owner = await createUser({ loginId: "pe7", nickname: "포스터7" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/endings`, {
      name: "잘못된 등급",
      grade: "LEGENDARY", // N|R|SR|SSR 아님
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("grade");
  });

  it("잘못된 operator → 400", async () => {
    const owner = await createUser({ loginId: "pe8", nickname: "포스터8" });
    const story = await createStory(owner.id);
    const statDef = await createStatDef(story.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/endings`, {
      name: "잘못된 조건",
      conditions: [{ statDefId: statDef.id, operator: "invalid_op", value: 50 }],
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("operator");
  });

  it("유효한 operator 목록 (gt, gte, lt, lte, eq, ne) 전부 통과", async () => {
    const owner = await createUser({ loginId: "pe9", nickname: "포스터9" });
    const story = await createStory(owner.id);
    const statDef = await createStatDef(story.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const validOperators = ["gt", "gte", "lt", "lte", "eq", "ne"];
    for (const op of validOperators) {
      const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/endings`, {
        name: `op_${op}`,
        conditions: [{ statDefId: statDef.id, operator: op, value: 50 }],
      });
      const res = await POST(req, makeContext({ id: story.id }));
      expect(res.status).toBe(201);
    }
  });

  it("name 20자 초과 → 400", async () => {
    const owner = await createUser({ loginId: "pe10", nickname: "포스터10" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/endings`, {
      name: "a".repeat(21), // 21자
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(400);
  });

  it("conditions 있는 엔딩 생성 → 201, conditions 포함 응답", async () => {
    const owner = await createUser({ loginId: "pe11", nickname: "포스터11" });
    const story = await createStory(owner.id);
    const statDef = await createStatDef(story.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/endings`, {
      name: "조건 엔딩",
      grade: "SR",
      conditions: [{ statDefId: statDef.id, operator: "gte", value: 80, groupId: 0 }],
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ending.conditions).toHaveLength(1);
    expect(body.ending.conditions[0].statDefId).toBe(statDef.id);
    expect(body.ending.conditions[0].operator).toBe("gte");
    expect(body.ending.conditions[0].value).toBe(80);
  });

  it("ADMIN은 타인 스토리에도 엔딩 생성 가능 → 201", async () => {
    const owner = await createUser({ loginId: "pe12", nickname: "포스터12" });
    const admin = await createUser({ loginId: "pe-admin", nickname: "관리자", role: "ADMIN" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: admin.id, role: "ADMIN" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/endings`, {
      name: "관리자 생성 엔딩",
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(201);
  });

  it("hint 20자 초과 → 400", async () => {
    const owner = await createUser({ loginId: "pe13", nickname: "포스터13" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/endings`, {
      name: "힌트초과엔딩",
      hint: "a".repeat(21), // 21자
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("hint");
  });

  it("prompt 500자 초과 → 400", async () => {
    const owner = await createUser({ loginId: "pe14", nickname: "포스터14" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/endings`, {
      name: "프롬프트초과",
      prompt: "a".repeat(501),
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(400);
  });

  it("엔딩 30개 초과 → 400", async () => {
    const owner = await createUser({ loginId: "pe15", nickname: "포스터15" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    // 30개 생성
    const prisma = getTestPrisma();
    for (let i = 0; i < 30; i++) {
      await prisma.storyEnding.create({
        data: {
          storyId: story.id,
          name: `엔딩${i}`,
          grade: "N",
          prompt: "",
          minTurn: 10,
          startTurn: 10,
          sortOrder: i,
        },
      });
    }

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/endings`, {
      name: "31번째 엔딩",
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("30");
  });

  it("잘못된 JSON body → 400", async () => {
    const owner = await createUser({ loginId: "pe16", nickname: "포스터16" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = new NextRequest(`http://localhost/api/stories/${story.id}/endings`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-valid-json{{{",
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// PUT /api/stories/[id]/endings/[endingId]
// ─────────────────────────────────────────────
describe("PUT /api/stories/[id]/endings/[endingId]", () => {
  it("미인증 → 401", async () => {
    mockAuth.mockResolvedValue(null);
    const owner = await createUser({ loginId: "epu1", nickname: "수정1" });
    const story = await createStory(owner.id);
    const ending = await createEnding(story.id, { name: "원본 엔딩" });

    const req = makeRequest("PUT", `http://localhost/api/stories/${story.id}/endings/${ending.id}`, {
      name: "수정된 엔딩",
    });
    const res = await PUT(req, makeContext({ id: story.id, endingId: ending.id }));

    expect(res.status).toBe(401);
  });

  it("소유자 수정 → 200, 변경된 name 확인", async () => {
    const owner = await createUser({ loginId: "epu2", nickname: "수정2" });
    const story = await createStory(owner.id);
    const ending = await createEnding(story.id, { name: "원본 엔딩" });
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("PUT", `http://localhost/api/stories/${story.id}/endings/${ending.id}`, {
      name: "수정된 엔딩 이름",
      grade: "SR",
    });
    const res = await PUT(req, makeContext({ id: story.id, endingId: ending.id }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ending.name).toBe("수정된 엔딩 이름");
    expect(body.ending.grade).toBe("SR");
  });

  it("타인 수정 시도 → 403", async () => {
    const owner = await createUser({ loginId: "epu3", nickname: "수정3" });
    const other = await createUser({ loginId: "epu4", nickname: "수정4" });
    const story = await createStory(owner.id);
    const ending = await createEnding(story.id, { name: "타인 수정불가" });
    mockAuth.mockResolvedValue({ user: { id: other.id, role: "USER" } });

    const req = makeRequest("PUT", `http://localhost/api/stories/${story.id}/endings/${ending.id}`, {
      name: "무단 수정",
    });
    const res = await PUT(req, makeContext({ id: story.id, endingId: ending.id }));

    expect(res.status).toBe(403);
  });

  it("존재하지 않는 endingId → 404", async () => {
    const owner = await createUser({ loginId: "epu5", nickname: "수정5" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("PUT", `http://localhost/api/stories/${story.id}/endings/nonexistent`, {
      name: "없는 엔딩 수정",
    });
    const res = await PUT(req, makeContext({ id: story.id, endingId: "nonexistent" }));

    expect(res.status).toBe(404);
  });

  it("잘못된 grade → 400", async () => {
    const owner = await createUser({ loginId: "epu6", nickname: "수정6" });
    const story = await createStory(owner.id);
    const ending = await createEnding(story.id, { name: "등급수정" });
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("PUT", `http://localhost/api/stories/${story.id}/endings/${ending.id}`, {
      grade: "EPIC", // 유효하지 않은 등급
    });
    const res = await PUT(req, makeContext({ id: story.id, endingId: ending.id }));

    expect(res.status).toBe(400);
  });

  it("잘못된 conditions operator → 400", async () => {
    const owner = await createUser({ loginId: "epu7", nickname: "수정7" });
    const story = await createStory(owner.id);
    const statDef = await createStatDef(story.id);
    const ending = await createEnding(story.id, { name: "조건수정" });
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("PUT", `http://localhost/api/stories/${story.id}/endings/${ending.id}`, {
      conditions: [{ statDefId: statDef.id, operator: "bad_op", value: 50 }],
    });
    const res = await PUT(req, makeContext({ id: story.id, endingId: ending.id }));

    expect(res.status).toBe(400);
  });

  it("conditions 업데이트 → 기존 삭제 후 재생성", async () => {
    const prisma = getTestPrisma();
    const owner = await createUser({ loginId: "epu8", nickname: "수정8" });
    const story = await createStory(owner.id);
    const statDef = await createStatDef(story.id);
    const ending = await createEnding(story.id, { name: "조건 교체" });

    // 기존 조건 생성
    await prisma.endingCondition.create({
      data: { endingId: ending.id, statDefId: statDef.id, operator: "gt", value: 30, groupId: 0 },
    });

    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("PUT", `http://localhost/api/stories/${story.id}/endings/${ending.id}`, {
      conditions: [{ statDefId: statDef.id, operator: "lte", value: 20, groupId: 0 }],
    });
    const res = await PUT(req, makeContext({ id: story.id, endingId: ending.id }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ending.conditions).toHaveLength(1);
    expect(body.ending.conditions[0].operator).toBe("lte");
    expect(body.ending.conditions[0].value).toBe(20);
  });
});

// ─────────────────────────────────────────────
// DELETE /api/stories/[id]/endings/[endingId]
// ─────────────────────────────────────────────
describe("DELETE /api/stories/[id]/endings/[endingId]", () => {
  it("미인증 → 401", async () => {
    mockAuth.mockResolvedValue(null);
    const owner = await createUser({ loginId: "del1", nickname: "삭제1" });
    const story = await createStory(owner.id);
    const ending = await createEnding(story.id, { name: "삭제 대상" });

    const req = makeRequest("DELETE", `http://localhost/api/stories/${story.id}/endings/${ending.id}`);
    const res = await DELETE(req, makeContext({ id: story.id, endingId: ending.id }));

    expect(res.status).toBe(401);
  });

  it("소유자 삭제 → 200, DB에서 실제 삭제 확인", async () => {
    const prisma = getTestPrisma();
    const owner = await createUser({ loginId: "del2", nickname: "삭제2" });
    const story = await createStory(owner.id);
    const ending = await createEnding(story.id, { name: "실제 삭제" });
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("DELETE", `http://localhost/api/stories/${story.id}/endings/${ending.id}`);
    const res = await DELETE(req, makeContext({ id: story.id, endingId: ending.id }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("message");

    const deleted = await prisma.storyEnding.findUnique({ where: { id: ending.id } });
    expect(deleted).toBeNull();
  });

  it("타인 삭제 시도 → 403", async () => {
    const owner = await createUser({ loginId: "del3", nickname: "삭제3" });
    const other = await createUser({ loginId: "del4", nickname: "삭제4" });
    const story = await createStory(owner.id);
    const ending = await createEnding(story.id, { name: "타인 삭제불가" });
    mockAuth.mockResolvedValue({ user: { id: other.id, role: "USER" } });

    const req = makeRequest("DELETE", `http://localhost/api/stories/${story.id}/endings/${ending.id}`);
    const res = await DELETE(req, makeContext({ id: story.id, endingId: ending.id }));

    expect(res.status).toBe(403);

    const prisma = getTestPrisma();
    const stillExists = await prisma.storyEnding.findUnique({ where: { id: ending.id } });
    expect(stillExists).not.toBeNull();
  });

  it("존재하지 않는 endingId → 404", async () => {
    const owner = await createUser({ loginId: "del5", nickname: "삭제5" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("DELETE", `http://localhost/api/stories/${story.id}/endings/nonexistent-ending`);
    const res = await DELETE(req, makeContext({ id: story.id, endingId: "nonexistent-ending" }));

    expect(res.status).toBe(404);
  });

  it("ADMIN은 타인 스토리의 엔딩도 삭제 가능 → 200", async () => {
    const owner = await createUser({ loginId: "del6", nickname: "삭제6" });
    const admin = await createUser({ loginId: "del-admin", nickname: "관리자삭제", role: "ADMIN" });
    const story = await createStory(owner.id);
    const ending = await createEnding(story.id, { name: "관리자 삭제" });
    mockAuth.mockResolvedValue({ user: { id: admin.id, role: "ADMIN" } });

    const req = makeRequest("DELETE", `http://localhost/api/stories/${story.id}/endings/${ending.id}`);
    const res = await DELETE(req, makeContext({ id: story.id, endingId: ending.id }));

    expect(res.status).toBe(200);
  });
});
