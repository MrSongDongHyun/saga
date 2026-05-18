// app/api/stories/[id]/stats/route.ts 통합 테스트
// GET  /api/stories/[id]/stats              — 스탯 목록 조회
// POST /api/stories/[id]/stats              — 스탯 생성
// PUT  /api/stories/[id]/stats/[statId]     — 스탯 수정
// DELETE /api/stories/[id]/stats/[statId]   — 스탯 삭제
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
} from "@/app/api/stories/[id]/stats/route";
import {
  PUT,
  DELETE,
} from "@/app/api/stories/[id]/stats/[statId]/route";

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

async function createStory(authorId: string, overrides: Partial<{ title: string }> = {}) {
  const prisma = getTestPrisma();
  return prisma.story.create({
    data: {
      title:      overrides.title ?? `스토리_${Date.now()}_${Math.random()}`,
      genre:      '["판타지"]',
      tags:       "[]",
      status:     "ONGOING",
      visibility: "PUBLIC",
      authorId,
    },
  });
}

async function createStatDef(
  storyId: string,
  overrides: Partial<{
    name: string;
    icon: string;
    color: string;
    minVal: number;
    maxVal: number;
    defaultVal: number;
  }> = {}
) {
  const prisma = getTestPrisma();
  return prisma.storyStatDef.create({
    data: {
      storyId,
      name:        overrides.name       ?? `스탯_${Date.now()}`,
      icon:        overrides.icon       ?? "circle",
      color:       overrides.color      ?? "yellow",
      minVal:      overrides.minVal     ?? 0,
      maxVal:      overrides.maxVal     ?? 100,
      defaultVal:  overrides.defaultVal ?? 50,
      description: "",
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
// GET /api/stories/[id]/stats
// ─────────────────────────────────────────────
describe("GET /api/stories/[id]/stats", () => {
  it("존재하는 스토리 → 200, statDefs 배열 반환", async () => {
    const owner = await createUser({ loginId: "sg1", nickname: "스탯게터1" });
    const story = await createStory(owner.id);
    await createStatDef(story.id, { name: "우호도" });
    await createStatDef(story.id, { name: "체력" });

    const req = makeRequest("GET", `http://localhost/api/stories/${story.id}/stats`);
    const res = await GET(req, makeContext({ id: story.id }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("statDefs");
    expect(Array.isArray(body.statDefs)).toBe(true);
    expect(body.statDefs).toHaveLength(2);
  });

  it("스탯 없는 스토리 → 200, 빈 배열", async () => {
    const owner = await createUser({ loginId: "sg2", nickname: "스탯게터2" });
    const story = await createStory(owner.id);

    const req = makeRequest("GET", `http://localhost/api/stories/${story.id}/stats`);
    const res = await GET(req, makeContext({ id: story.id }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.statDefs).toEqual([]);
  });

  it("존재하지 않는 스토리 → 404", async () => {
    const req = makeRequest("GET", "http://localhost/api/stories/nonexistent/stats");
    const res = await GET(req, makeContext({ id: "nonexistent" }));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("스탯에 levels 배열 포함", async () => {
    const owner = await createUser({ loginId: "sg3", nickname: "스탯게터3" });
    const story = await createStory(owner.id);
    const statDef = await createStatDef(story.id, { name: "레벨있는스탯" });
    const prisma = getTestPrisma();
    await prisma.statLevel.create({
      data: { statDefId: statDef.id, name: "낮음", minVal: 0, maxVal: 30, prompt: "낮은 상태", sortOrder: 0 },
    });
    await prisma.statLevel.create({
      data: { statDefId: statDef.id, name: "높음", minVal: 70, maxVal: 100, prompt: "높은 상태", sortOrder: 1 },
    });

    const req = makeRequest("GET", `http://localhost/api/stories/${story.id}/stats`);
    const res = await GET(req, makeContext({ id: story.id }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.statDefs[0].levels).toHaveLength(2);
    expect(body.statDefs[0].levels[0].name).toBe("낮음");
    expect(body.statDefs[0].levels[1].name).toBe("높음");
  });
});

// ─────────────────────────────────────────────
// POST /api/stories/[id]/stats
// ─────────────────────────────────────────────
describe("POST /api/stories/[id]/stats", () => {
  it("미인증 → 401", async () => {
    mockAuth.mockResolvedValue(null);
    const owner = await createUser({ loginId: "sp1", nickname: "스탯포스터1" });
    const story = await createStory(owner.id);

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/stats`, {
      name: "우호도",
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(401);
  });

  it("소유자 스탯 생성 → 201, statDef 포함 응답", async () => {
    const owner = await createUser({ loginId: "sp2", nickname: "스탯포스터2" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/stats`, {
      name: "우호도",
      icon: "heart",
      color: "red",
      unit: "%",
      minVal: 0,
      maxVal: 100,
      defaultVal: 50,
      description: "캐릭터와의 우호도",
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("statDef");
    expect(body.statDef.name).toBe("우호도");
    expect(body.statDef.icon).toBe("heart");
    expect(body.statDef.color).toBe("red");
    expect(body.statDef.storyId).toBe(story.id);
  });

  it("타인 스토리에 스탯 생성 → 403", async () => {
    const owner = await createUser({ loginId: "sp3", nickname: "스탯포스터3" });
    const other = await createUser({ loginId: "sp4", nickname: "스탯포스터4" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: other.id, role: "USER" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/stats`, {
      name: "무단 스탯",
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(403);
  });

  it("존재하지 않는 스토리 → 404", async () => {
    const user = await createUser({ loginId: "sp5", nickname: "스탯포스터5" });
    mockAuth.mockResolvedValue({ user: { id: user.id, role: "USER" } });

    const req = makeRequest("POST", "http://localhost/api/stories/nonexistent/stats", {
      name: "없는 스토리 스탯",
    });
    const res = await POST(req, makeContext({ id: "nonexistent" }));

    expect(res.status).toBe(404);
  });

  it("name 누락 → 400", async () => {
    const owner = await createUser({ loginId: "sp6", nickname: "스탯포스터6" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/stats`, {
      icon: "heart",
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(400);
  });

  it("name 10자 초과 → 400", async () => {
    const owner = await createUser({ loginId: "sp7", nickname: "스탯포스터7" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/stats`, {
      name: "열한글자스탯이름",  // 9자지만 테스트용으로 11자 사용
    });
    // 정확히 11자로 생성
    const req2 = makeRequest("POST", `http://localhost/api/stories/${story.id}/stats`, {
      name: "12345678901", // 11자
    });
    const res = await POST(req2, makeContext({ id: story.id }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("name");
  });

  it("잘못된 icon → 400", async () => {
    const owner = await createUser({ loginId: "sp8", nickname: "스탯포스터8" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/stats`, {
      name: "아이콘오류",
      icon: "invalid_icon",
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("icon");
  });

  it("잘못된 color → 400", async () => {
    const owner = await createUser({ loginId: "sp9", nickname: "스탯포스터9" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/stats`, {
      name: "컬러오류",
      color: "rainbow",
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("color");
  });

  it("unit 3자 초과 → 400", async () => {
    const owner = await createUser({ loginId: "sp10", nickname: "스탯포스터10" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/stats`, {
      name: "유닛오류",
      unit: "abcd", // 4자
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("unit");
  });

  it("levels 포함 스탯 생성 → 201, levels 포함 응답", async () => {
    const owner = await createUser({ loginId: "sp11", nickname: "스탯포스터11" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/stats`, {
      name: "레벨스탯",
      levels: [
        { name: "낮음", minVal: 0, maxVal: 30, prompt: "낮은 레벨" },
        { name: "보통", minVal: 31, maxVal: 70, prompt: "보통 레벨" },
        { name: "높음", minVal: 71, maxVal: 100, prompt: "높은 레벨" },
      ],
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.statDef.levels).toHaveLength(3);
    expect(body.statDef.levels[0].name).toBe("낮음");
    expect(body.statDef.levels[2].name).toBe("높음");
  });

  it("레벨 name 10자 초과 → 400", async () => {
    const owner = await createUser({ loginId: "sp12", nickname: "스탯포스터12" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/stats`, {
      name: "레벨명오류",
      levels: [{ name: "12345678901", minVal: 0, maxVal: 100 }], // 11자
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("레벨 name");
  });

  it("레벨 minVal/maxVal 숫자 아님 → 400", async () => {
    const owner = await createUser({ loginId: "sp13", nickname: "스탯포스터13" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/stats`, {
      name: "레벨범위오류",
      levels: [{ name: "레벨1", minVal: "낮음", maxVal: 100 }], // minVal이 문자열
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(400);
  });

  it("스탯 20개 초과 → 400", async () => {
    const owner = await createUser({ loginId: "sp14", nickname: "스탯포스터14" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    // 20개 스탯 생성
    const prisma = getTestPrisma();
    for (let i = 0; i < 20; i++) {
      await prisma.storyStatDef.create({
        data: {
          storyId: story.id,
          name: `스탯${i}`,
          icon: "circle",
          color: "yellow",
          minVal: 0,
          maxVal: 100,
          defaultVal: 50,
          description: "",
        },
      });
    }

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/stats`, {
      name: "21번째 스탯",
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("20");
  });

  it("기본값 적용 확인 (icon=circle, color=yellow, minVal=0, maxVal=100, defaultVal=50)", async () => {
    const owner = await createUser({ loginId: "sp15", nickname: "스탯포스터15" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/stats`, {
      name: "기본값스탯",
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.statDef.icon).toBe("circle");
    expect(body.statDef.color).toBe("yellow");
    expect(body.statDef.minVal).toBe(0);
    expect(body.statDef.maxVal).toBe(100);
    expect(body.statDef.defaultVal).toBe(50);
  });

  it("ADMIN은 타인 스토리에도 스탯 생성 가능 → 201", async () => {
    const owner = await createUser({ loginId: "sp16", nickname: "스탯포스터16" });
    const admin = await createUser({ loginId: "sp-admin", nickname: "관리자스탯", role: "ADMIN" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: admin.id, role: "ADMIN" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/stats`, {
      name: "관리자스탯",
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(201);
  });

  it("잘못된 JSON body → 400", async () => {
    const owner = await createUser({ loginId: "sp17", nickname: "스탯포스터17" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = new NextRequest(`http://localhost/api/stories/${story.id}/stats`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{{invalid_json}}",
    });
    const res = await POST(req, makeContext({ id: story.id }));

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// PUT /api/stories/[id]/stats/[statId]
// ─────────────────────────────────────────────
describe("PUT /api/stories/[id]/stats/[statId]", () => {
  it("미인증 → 401", async () => {
    mockAuth.mockResolvedValue(null);
    const owner = await createUser({ loginId: "spu1", nickname: "스탯수정1" });
    const story = await createStory(owner.id);
    const statDef = await createStatDef(story.id, { name: "원본스탯" });

    const req = makeRequest("PUT", `http://localhost/api/stories/${story.id}/stats/${statDef.id}`, {
      name: "수정된 스탯",
    });
    const res = await PUT(req, makeContext({ id: story.id, statId: statDef.id }));

    expect(res.status).toBe(401);
  });

  it("소유자 스탯 수정 → 200, 변경 확인", async () => {
    const owner = await createUser({ loginId: "spu2", nickname: "스탯수정2" });
    const story = await createStory(owner.id);
    const statDef = await createStatDef(story.id, { name: "원본스탯2" });
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("PUT", `http://localhost/api/stories/${story.id}/stats/${statDef.id}`, {
      name: "수정된이름",
      icon: "star",
      color: "blue",
    });
    const res = await PUT(req, makeContext({ id: story.id, statId: statDef.id }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.statDef.name).toBe("수정된이름");
    expect(body.statDef.icon).toBe("star");
    expect(body.statDef.color).toBe("blue");
  });

  it("타인 수정 시도 → 403", async () => {
    const owner = await createUser({ loginId: "spu3", nickname: "스탯수정3" });
    const other = await createUser({ loginId: "spu4", nickname: "스탯수정4" });
    const story = await createStory(owner.id);
    const statDef = await createStatDef(story.id);
    mockAuth.mockResolvedValue({ user: { id: other.id, role: "USER" } });

    const req = makeRequest("PUT", `http://localhost/api/stories/${story.id}/stats/${statDef.id}`, {
      name: "무단수정",
    });
    const res = await PUT(req, makeContext({ id: story.id, statId: statDef.id }));

    expect(res.status).toBe(403);
  });

  it("존재하지 않는 statId → 404", async () => {
    const owner = await createUser({ loginId: "spu5", nickname: "스탯수정5" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("PUT", `http://localhost/api/stories/${story.id}/stats/nonexistent`, {
      name: "없는 스탯 수정",
    });
    const res = await PUT(req, makeContext({ id: story.id, statId: "nonexistent" }));

    expect(res.status).toBe(404);
  });

  it("잘못된 icon → 400", async () => {
    const owner = await createUser({ loginId: "spu6", nickname: "스탯수정6" });
    const story = await createStory(owner.id);
    const statDef = await createStatDef(story.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("PUT", `http://localhost/api/stories/${story.id}/stats/${statDef.id}`, {
      icon: "invalid_icon",
    });
    const res = await PUT(req, makeContext({ id: story.id, statId: statDef.id }));

    expect(res.status).toBe(400);
  });

  it("levels 업데이트 → 기존 레벨 삭제 후 재생성", async () => {
    const prisma = getTestPrisma();
    const owner = await createUser({ loginId: "spu7", nickname: "스탯수정7" });
    const story = await createStory(owner.id);
    const statDef = await createStatDef(story.id, { name: "레벨교체스탯" });

    // 기존 레벨
    await prisma.statLevel.create({
      data: { statDefId: statDef.id, name: "구레벨", minVal: 0, maxVal: 100, prompt: "", sortOrder: 0 },
    });

    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("PUT", `http://localhost/api/stories/${story.id}/stats/${statDef.id}`, {
      levels: [
        { name: "신레벨1", minVal: 0, maxVal: 50 },
        { name: "신레벨2", minVal: 51, maxVal: 100 },
      ],
    });
    const res = await PUT(req, makeContext({ id: story.id, statId: statDef.id }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.statDef.levels).toHaveLength(2);
    expect(body.statDef.levels[0].name).toBe("신레벨1");
    expect(body.statDef.levels[1].name).toBe("신레벨2");
  });

  it("name 10자 초과 → 400", async () => {
    const owner = await createUser({ loginId: "spu8", nickname: "스탯수정8" });
    const story = await createStory(owner.id);
    const statDef = await createStatDef(story.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("PUT", `http://localhost/api/stories/${story.id}/stats/${statDef.id}`, {
      name: "12345678901", // 11자
    });
    const res = await PUT(req, makeContext({ id: story.id, statId: statDef.id }));

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// DELETE /api/stories/[id]/stats/[statId]
// ─────────────────────────────────────────────
describe("DELETE /api/stories/[id]/stats/[statId]", () => {
  it("미인증 → 401", async () => {
    mockAuth.mockResolvedValue(null);
    const owner = await createUser({ loginId: "sd1", nickname: "스탯삭제1" });
    const story = await createStory(owner.id);
    const statDef = await createStatDef(story.id, { name: "삭제 대상 스탯" });

    const req = makeRequest("DELETE", `http://localhost/api/stories/${story.id}/stats/${statDef.id}`);
    const res = await DELETE(req, makeContext({ id: story.id, statId: statDef.id }));

    expect(res.status).toBe(401);
  });

  it("소유자 삭제 → 200, DB에서 실제 삭제 확인", async () => {
    const prisma = getTestPrisma();
    const owner = await createUser({ loginId: "sd2", nickname: "스탯삭제2" });
    const story = await createStory(owner.id);
    const statDef = await createStatDef(story.id, { name: "실제 삭제 스탯" });
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("DELETE", `http://localhost/api/stories/${story.id}/stats/${statDef.id}`);
    const res = await DELETE(req, makeContext({ id: story.id, statId: statDef.id }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("message");

    const deleted = await prisma.storyStatDef.findUnique({ where: { id: statDef.id } });
    expect(deleted).toBeNull();
  });

  it("타인 삭제 시도 → 403", async () => {
    const owner = await createUser({ loginId: "sd3", nickname: "스탯삭제3" });
    const other = await createUser({ loginId: "sd4", nickname: "스탯삭제4" });
    const story = await createStory(owner.id);
    const statDef = await createStatDef(story.id);
    mockAuth.mockResolvedValue({ user: { id: other.id, role: "USER" } });

    const req = makeRequest("DELETE", `http://localhost/api/stories/${story.id}/stats/${statDef.id}`);
    const res = await DELETE(req, makeContext({ id: story.id, statId: statDef.id }));

    expect(res.status).toBe(403);

    const prisma = getTestPrisma();
    const stillExists = await prisma.storyStatDef.findUnique({ where: { id: statDef.id } });
    expect(stillExists).not.toBeNull();
  });

  it("존재하지 않는 statId → 404", async () => {
    const owner = await createUser({ loginId: "sd5", nickname: "스탯삭제5" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("DELETE", `http://localhost/api/stories/${story.id}/stats/nonexistent-stat`);
    const res = await DELETE(req, makeContext({ id: story.id, statId: "nonexistent-stat" }));

    expect(res.status).toBe(404);
  });

  it("ADMIN은 타인 스토리의 스탯도 삭제 가능 → 200", async () => {
    const owner = await createUser({ loginId: "sd6", nickname: "스탯삭제6" });
    const admin = await createUser({ loginId: "sd-admin", nickname: "관리자삭제", role: "ADMIN" });
    const story = await createStory(owner.id);
    const statDef = await createStatDef(story.id, { name: "관리자 삭제 스탯" });
    mockAuth.mockResolvedValue({ user: { id: admin.id, role: "ADMIN" } });

    const req = makeRequest("DELETE", `http://localhost/api/stories/${story.id}/stats/${statDef.id}`);
    const res = await DELETE(req, makeContext({ id: story.id, statId: statDef.id }));

    expect(res.status).toBe(200);
  });
});
