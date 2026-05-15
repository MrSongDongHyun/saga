// app/api/characters/route.ts 통합 테스트
// GET  /api/characters  — 공개 목록 조회
// POST /api/characters  — 캐릭터 생성 (인증 필요)
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/characters/route";
import { NextRequest } from "next/server";
import { getTestPrisma } from "../setup";

// ── auth() 모킹 ────────────────────────────────────────────────
// NextAuth 실제 호출 차단 (세션 없이 테스트 가능하도록)
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
const mockAuth = auth as ReturnType<typeof vi.fn>;

// ─────────────────────────────────────────────
// 헬퍼 함수
// ─────────────────────────────────────────────

/** GET /api/characters 요청 생성 */
function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/characters");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url.toString());
}

/** POST /api/characters 요청 생성 */
function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/characters", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** 테스트용 사용자 DB 생성 헬퍼 */
async function createUser(
  loginId = "user1",
  nickname = "유저1",
  role = "USER"
) {
  return getTestPrisma().user.create({
    data: { loginId, password: "hashed", nickname, role },
  });
}

/** 테스트용 캐릭터 DB 생성 헬퍼 */
async function createCharacter(
  creatorId: string,
  overrides?: Partial<{
    name: string;
    visibility: string;
    tags: string;
    description: string;
  }>
) {
  return getTestPrisma().character.create({
    data: {
      name: overrides?.name ?? "테스트 캐릭터",
      tags: overrides?.tags ?? JSON.stringify([]),
      visibility: overrides?.visibility ?? "PUBLIC",
      description: overrides?.description,
      creatorId,
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
// GET /api/characters
// ─────────────────────────────────────────────
describe("GET /api/characters", () => {
  it("DB 비어있을 때 → 200, characters: [], pagination 포함", async () => {
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.characters).toEqual([]);
    expect(body).toHaveProperty("pagination");
    expect(body.pagination).toHaveProperty("page");
    expect(body.pagination).toHaveProperty("limit");
    expect(body.pagination).toHaveProperty("total");
    expect(body.pagination).toHaveProperty("totalPages");
    expect(body.pagination.total).toBe(0);
  });

  it("공개 캐릭터 2개 → 200, characters 2개 반환", async () => {
    const user = await createUser("listuser1", "목록유저1");
    await createCharacter(user.id, { name: "첫 번째 캐릭터", visibility: "PUBLIC" });
    await createCharacter(user.id, { name: "두 번째 캐릭터", visibility: "PUBLIC" });

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.characters).toHaveLength(2);
    expect(body.pagination.total).toBe(2);
  });

  it("PRIVATE 캐릭터 → 목록에 포함되지 않음", async () => {
    const user = await createUser("listuser2", "목록유저2");
    await createCharacter(user.id, { name: "공개 캐릭터", visibility: "PUBLIC" });
    await createCharacter(user.id, { name: "비공개 캐릭터", visibility: "PRIVATE" });

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    // PUBLIC만 반환
    expect(body.characters).toHaveLength(1);
    expect(body.characters[0].name).toBe("공개 캐릭터");
    expect(body.pagination.total).toBe(1);
  });

  it("UNLISTED 캐릭터 → 목록에 포함되지 않음", async () => {
    const user = await createUser("listuser3", "목록유저3");
    await createCharacter(user.id, { name: "비상장 캐릭터", visibility: "UNLISTED" });

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.characters).toHaveLength(0);
  });

  it("q 이름 검색 → 해당 캐릭터만 반환", async () => {
    const user = await createUser("searchuser1", "검색유저1");
    await createCharacter(user.id, { name: "용사 캐릭터", visibility: "PUBLIC" });
    await createCharacter(user.id, { name: "마법사 캐릭터", visibility: "PUBLIC" });
    await createCharacter(user.id, { name: "용사와 마법사", visibility: "PUBLIC" });

    const res = await GET(makeGetRequest({ q: "용사" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.characters).toHaveLength(2);
    body.characters.forEach((c: { name: string }) => {
      expect(c.name).toContain("용사");
    });
  });

  it("q 검색 결과 없음 → 빈 배열 반환", async () => {
    const user = await createUser("searchuser2", "검색유저2");
    await createCharacter(user.id, { name: "완전 다른 이름", visibility: "PUBLIC" });

    const res = await GET(makeGetRequest({ q: "존재하지않는캐릭터XYZ" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.characters).toEqual([]);
    expect(body.pagination.total).toBe(0);
  });

  it("응답 캐릭터에 tags 배열로 파싱됨", async () => {
    const user = await createUser("fielduser1", "필드유저1");
    await createCharacter(user.id, {
      name: "태그 캐릭터",
      visibility: "PUBLIC",
      tags: JSON.stringify(["판타지", "마법사"]),
    });

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(body.characters).toHaveLength(1);
    expect(Array.isArray(body.characters[0].tags)).toBe(true);
    expect(body.characters[0].tags).toEqual(["판타지", "마법사"]);
  });

  it("응답 캐릭터에 creator 정보 포함", async () => {
    const user = await createUser("creatoruser1", "제작자유저1");
    await createCharacter(user.id, { name: "제작자확인 캐릭터", visibility: "PUBLIC" });

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(body.characters[0]).toHaveProperty("creator");
    expect(body.characters[0].creator.id).toBe(user.id);
    expect(body.characters[0].creator.nickname).toBe("제작자유저1");
  });

  it("pagination 기본값 확인 (page=1, limit=20)", async () => {
    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(20);
  });

  it("limit 최댓값 50 제한 확인", async () => {
    const res = await GET(makeGetRequest({ limit: "100" }));
    const body = await res.json();

    // 100을 요청해도 50으로 제한됨
    expect(body.pagination.limit).toBe(50);
  });
});

// ─────────────────────────────────────────────
// POST /api/characters
// ─────────────────────────────────────────────
describe("POST /api/characters", () => {
  it("미인증 → 401", async () => {
    // auth()가 null 반환 → requireAuth()가 401 throw
    mockAuth.mockResolvedValue(null);

    const req = makePostRequest({ name: "새 캐릭터" });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("유효한 입력 + 인증 → 201, id 포함 응답", async () => {
    const user = await createUser("createuser1", "생성유저1");

    mockAuth.mockResolvedValue({
      user: { id: user.id, role: "USER" },
    });

    const req = makePostRequest({ name: "새로운 캐릭터" });
    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(typeof body.id).toBe("string");
    expect(body.name).toBe("새로운 캐릭터");
  });

  it("인증 후 캐릭터 생성 → 기본값 적용 확인 (tags:[], visibility:PUBLIC)", async () => {
    const user = await createUser("createuser2", "생성유저2");

    mockAuth.mockResolvedValue({
      user: { id: user.id, role: "USER" },
    });

    const req = makePostRequest({ name: "기본값 테스트 캐릭터" });
    const res = await POST(req);
    const body = await res.json();

    expect(body.tags).toEqual([]);
    expect(body.visibility).toBe("PUBLIC");
  });

  it("인증 후 캐릭터 생성 → DB에 실제 저장 확인", async () => {
    const prisma = getTestPrisma();
    const user = await createUser("createuser3", "생성유저3");

    mockAuth.mockResolvedValue({
      user: { id: user.id, role: "USER" },
    });

    const req = makePostRequest({
      name: "DB저장 확인 캐릭터",
      description: "소개글",
      tags: ["판타지"],
      visibility: "PRIVATE",
    });

    await POST(req);

    const saved = await prisma.character.findFirst({
      where: { name: "DB저장 확인 캐릭터" },
    });

    expect(saved).not.toBeNull();
    expect(saved!.creatorId).toBe(user.id);
    expect(saved!.description).toBe("소개글");
    expect(saved!.tags).toBe('["판타지"]');
    expect(saved!.visibility).toBe("PRIVATE");
  });

  it("name 누락 → 400", async () => {
    const user = await createUser("createuser4", "생성유저4");

    mockAuth.mockResolvedValue({
      user: { id: user.id, role: "USER" },
    });

    const req = makePostRequest({ description: "이름 없는 캐릭터" });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("name 51자 → 400", async () => {
    const user = await createUser("createuser5", "생성유저5");

    mockAuth.mockResolvedValue({
      user: { id: user.id, role: "USER" },
    });

    const req = makePostRequest({ name: "가".repeat(51) });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("잘못된 JSON 바디 → 400", async () => {
    const user = await createUser("createuser6", "생성유저6");

    mockAuth.mockResolvedValue({
      user: { id: user.id, role: "USER" },
    });

    const req = new NextRequest("http://localhost/api/characters", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-valid-json{{{",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("응답에 backgroundStory, firstMessage 포함 (상세 형식)", async () => {
    const user = await createUser("createuser7", "생성유저7");

    mockAuth.mockResolvedValue({
      user: { id: user.id, role: "USER" },
    });

    const req = makePostRequest({
      name: "상세필드 확인 캐릭터",
      backgroundStory: "배경 이야기",
      firstMessage: "첫 인사말",
    });

    const res = await POST(req);
    const body = await res.json();

    expect(body).toHaveProperty("backgroundStory");
    expect(body).toHaveProperty("firstMessage");
    expect(body.backgroundStory).toBe("배경 이야기");
    expect(body.firstMessage).toBe("첫 인사말");
  });
});
