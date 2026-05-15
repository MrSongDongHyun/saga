// app/api/stories/route.ts 통합 테스트
// GET /api/stories  — 공개 목록 조회
// POST /api/stories — 스토리 생성 (인증 필요)
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET, POST } from "@/app/api/stories/route";
import { NextRequest } from "next/server";
import { getTestPrisma } from "../setup";
import bcrypt from "bcryptjs";

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

/** GET /api/stories 요청 생성 */
function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/stories");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url.toString());
}

/** POST /api/stories 요청 생성 */
function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/stories", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** 테스트용 사용자 DB 생성 헬퍼 */
async function createTestUser(
  overrides: Partial<{
    loginId: string;
    nickname: string;
    role: string;
  }> = {}
) {
  const prisma = getTestPrisma();
  const hashed = await bcrypt.hash("testpass", 4); // cost=4: 빠른 해시
  return prisma.user.create({
    data: {
      loginId: overrides.loginId ?? `user_${Date.now()}_${Math.random()}`,
      password: hashed,
      nickname: overrides.nickname ?? `nick_${Date.now()}_${Math.random()}`,
      role: overrides.role ?? "USER",
    },
  });
}

/** 테스트용 스토리 DB 생성 헬퍼 */
async function createTestStory(
  authorId: string,
  overrides: Partial<{
    title: string;
    status: string;
    visibility: string;
    genre: string;
    tags: string;
  }> = {}
) {
  const prisma = getTestPrisma();
  return prisma.story.create({
    data: {
      title: overrides.title ?? `스토리_${Date.now()}_${Math.random()}`,
      genre: overrides.genre ?? '["판타지"]',
      tags: overrides.tags ?? "[]",
      status: overrides.status ?? "ONGOING",
      visibility: overrides.visibility ?? "PUBLIC",
      authorId,
    },
  });
}

// ─────────────────────────────────────────────
// beforeEach: mock 초기화
// ─────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  // GET 테스트는 auth를 호출하지 않지만, 초기화해둠
  mockAuth.mockResolvedValue(null);
});

// ─────────────────────────────────────────────
// GET /api/stories
// ─────────────────────────────────────────────
describe("GET /api/stories", () => {
  it("DB 비어있을 때 → 200, stories: [], pagination 포함", async () => {
    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stories).toEqual([]);
    expect(body).toHaveProperty("pagination");
    expect(body.pagination).toHaveProperty("page");
    expect(body.pagination).toHaveProperty("limit");
    expect(body.pagination).toHaveProperty("total");
    expect(body.pagination).toHaveProperty("totalPages");
    expect(body.pagination.total).toBe(0);
  });

  it("공개 스토리 2개 → 200, stories 2개 반환", async () => {
    const user = await createTestUser({ loginId: "listuser1", nickname: "목록유저1" });
    await createTestStory(user.id, {
      title: "첫 번째 스토리",
      visibility: "PUBLIC",
    });
    await createTestStory(user.id, {
      title: "두 번째 스토리",
      visibility: "PUBLIC",
    });

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stories).toHaveLength(2);
    expect(body.pagination.total).toBe(2);
  });

  it("PRIVATE 스토리 → 목록에 포함되지 않음", async () => {
    const user = await createTestUser({ loginId: "listuser2", nickname: "목록유저2" });
    await createTestStory(user.id, {
      title: "공개 스토리",
      visibility: "PUBLIC",
    });
    await createTestStory(user.id, {
      title: "비공개 스토리",
      visibility: "PRIVATE",
    });

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    // PUBLIC만 반환
    expect(body.stories).toHaveLength(1);
    expect(body.stories[0].title).toBe("공개 스토리");
    expect(body.pagination.total).toBe(1);
  });

  it("UNLISTED 스토리 → 목록에 포함되지 않음", async () => {
    const user = await createTestUser({ loginId: "listuser3", nickname: "목록유저3" });
    await createTestStory(user.id, { title: "비상장 스토리", visibility: "UNLISTED" });

    const res = await GET(makeGetRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stories).toHaveLength(0);
  });

  it("page=2, limit=1 → 두 번째 스토리만 반환", async () => {
    const user = await createTestUser({ loginId: "pageuser1", nickname: "페이지유저1" });

    // createdAt 순서를 보장하기 위해 순차 생성
    await createTestStory(user.id, { title: "오래된 스토리", visibility: "PUBLIC" });
    // 약간 시차를 두기 위한 방법 대신 updatedAt 기준 대신 id로 구분
    await new Promise((r) => setTimeout(r, 10)); // SQLite timestamp 정밀도
    await createTestStory(user.id, { title: "최신 스토리", visibility: "PUBLIC" });

    // sort 기본값 latest(createdAt desc) → 최신 스토리가 page=1, 오래된 스토리가 page=2
    const res = await GET(makeGetRequest({ page: "2", limit: "1" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stories).toHaveLength(1);
    expect(body.stories[0].title).toBe("오래된 스토리");
    expect(body.pagination.page).toBe(2);
    expect(body.pagination.limit).toBe(1);
  });

  it("status=COMPLETED 필터 → COMPLETED 스토리만 반환", async () => {
    const user = await createTestUser({ loginId: "statususer1", nickname: "상태유저1" });
    await createTestStory(user.id, {
      title: "연재 중",
      status: "ONGOING",
      visibility: "PUBLIC",
    });
    await createTestStory(user.id, {
      title: "완결",
      status: "COMPLETED",
      visibility: "PUBLIC",
    });
    await createTestStory(user.id, {
      title: "휴재",
      status: "HIATUS",
      visibility: "PUBLIC",
    });

    const res = await GET(makeGetRequest({ status: "COMPLETED" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stories).toHaveLength(1);
    expect(body.stories[0].title).toBe("완결");
    expect(body.stories[0].status).toBe("COMPLETED");
  });

  it("sort=popular → likeCount 기준 정렬 (좋아요가 있을 때)", async () => {
    const prisma = getTestPrisma();
    const author = await createTestUser({ loginId: "popuser1", nickname: "인기유저1" });
    const liker = await createTestUser({ loginId: "liker001", nickname: "좋아요유저" });

    const storyA = await createTestStory(author.id, {
      title: "좋아요 없는 스토리",
      visibility: "PUBLIC",
    });
    const storyB = await createTestStory(author.id, {
      title: "좋아요 많은 스토리",
      visibility: "PUBLIC",
    });

    // storyB에 좋아요 추가
    await prisma.like.create({
      data: { userId: liker.id, storyId: storyB.id },
    });

    const res = await GET(makeGetRequest({ sort: "popular" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stories).toHaveLength(2);
    // likeCount 내림차순: storyB(1) → storyA(0)
    expect(body.stories[0].title).toBe("좋아요 많은 스토리");
    expect(body.stories[0].likeCount).toBe(1);
    expect(body.stories[1].likeCount).toBe(0);
  });

  it("q 제목 검색 → 검색어 포함된 스토리만 반환", async () => {
    const user = await createTestUser({ loginId: "searchuser1", nickname: "검색유저1" });
    await createTestStory(user.id, {
      title: "용사의 모험",
      visibility: "PUBLIC",
    });
    await createTestStory(user.id, {
      title: "마법사의 일상",
      visibility: "PUBLIC",
    });
    await createTestStory(user.id, {
      title: "용사와 마법사",
      visibility: "PUBLIC",
    });

    const res = await GET(makeGetRequest({ q: "용사" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stories).toHaveLength(2);
    body.stories.forEach((s: { title: string }) => {
      expect(s.title).toContain("용사");
    });
  });

  it("q 검색 결과 없음 → 빈 배열 반환", async () => {
    const user = await createTestUser({ loginId: "searchuser2", nickname: "검색유저2" });
    await createTestStory(user.id, { title: "완전 다른 제목", visibility: "PUBLIC" });

    const res = await GET(makeGetRequest({ q: "존재하지않는제목XYZ" }));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stories).toEqual([]);
    expect(body.pagination.total).toBe(0);
  });

  it("응답 스토리에 genre/tags 배열로 파싱됨", async () => {
    const user = await createTestUser({ loginId: "fielduser1", nickname: "필드유저1" });
    await createTestStory(user.id, {
      title: "장르태그 테스트",
      visibility: "PUBLIC",
      genre: '["판타지","로맨스"]',
      tags: '["이세계","회귀"]',
    });

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(body.stories).toHaveLength(1);
    expect(Array.isArray(body.stories[0].genre)).toBe(true);
    expect(body.stories[0].genre).toEqual(["판타지", "로맨스"]);
    expect(Array.isArray(body.stories[0].tags)).toBe(true);
    expect(body.stories[0].tags).toEqual(["이세계", "회귀"]);
  });

  it("응답 스토리에 author 정보 포함", async () => {
    const user = await createTestUser({ loginId: "authoruser1", nickname: "저자유저1" });
    await createTestStory(user.id, { title: "저자확인 스토리", visibility: "PUBLIC" });

    const res = await GET(makeGetRequest());
    const body = await res.json();

    expect(body.stories[0]).toHaveProperty("author");
    expect(body.stories[0].author.id).toBe(user.id);
    expect(body.stories[0].author.nickname).toBe("저자유저1");
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
// POST /api/stories
// ─────────────────────────────────────────────
describe("POST /api/stories", () => {
  it("인증 없이 → 401", async () => {
    // auth()가 null 반환 → requireAuth()가 401 throw
    mockAuth.mockResolvedValue(null);

    const req = makePostRequest({
      title: "새 스토리",
      genre: ["판타지"],
    });

    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  it("유효한 입력 + 인증 → 201, id 포함 응답", async () => {
    // DB에 실제 사용자 생성
    const user = await createTestUser({
      loginId: "createuser1",
      nickname: "생성유저1",
    });

    // auth() mock: 해당 유저 세션 반환
    mockAuth.mockResolvedValue({
      user: { id: user.id, role: "USER" },
    });

    const req = makePostRequest({
      title: "새로운 스토리",
      genre: ["판타지"],
    });

    const res = await POST(req);

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("id");
    expect(typeof body.id).toBe("string");
    expect(body.title).toBe("새로운 스토리");
  });

  it("인증 후 스토리 생성 → DB에 실제 저장 확인", async () => {
    const prisma = getTestPrisma();
    const user = await createTestUser({
      loginId: "createuser2",
      nickname: "생성유저2",
    });

    mockAuth.mockResolvedValue({
      user: { id: user.id, role: "USER" },
    });

    const req = makePostRequest({
      title: "DB저장 확인 스토리",
      genre: ["로맨스"],
      tags: ["현대물"],
      status: "ONGOING",
      visibility: "PUBLIC",
    });

    await POST(req);

    const saved = await prisma.story.findFirst({
      where: { title: "DB저장 확인 스토리" },
    });

    expect(saved).not.toBeNull();
    expect(saved!.authorId).toBe(user.id);
    expect(saved!.genre).toBe('["로맨스"]');
    expect(saved!.tags).toBe('["현대물"]');
  });

  it("인증 후 스토리 생성 → 기본값 적용 확인 (ONGOING, PUBLIC)", async () => {
    const user = await createTestUser({
      loginId: "createuser3",
      nickname: "생성유저3",
    });

    mockAuth.mockResolvedValue({
      user: { id: user.id, role: "USER" },
    });

    const req = makePostRequest({
      title: "기본값 테스트",
      genre: ["SF"],
    });

    const res = await POST(req);
    const body = await res.json();

    expect(body.status).toBe("ONGOING");
    expect(body.visibility).toBe("PUBLIC");
    expect(body.tags).toEqual([]);
  });

  it("title 누락 → 400", async () => {
    const user = await createTestUser({
      loginId: "createuser4",
      nickname: "생성유저4",
    });

    mockAuth.mockResolvedValue({
      user: { id: user.id, role: "USER" },
    });

    const req = makePostRequest({ genre: ["판타지"] });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("genre 빈 배열 → 400", async () => {
    const user = await createTestUser({
      loginId: "createuser5",
      nickname: "생성유저5",
    });

    mockAuth.mockResolvedValue({
      user: { id: user.id, role: "USER" },
    });

    const req = makePostRequest({ title: "장르없는 스토리", genre: [] });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("잘못된 JSON 바디 → 400", async () => {
    const user = await createTestUser({
      loginId: "createuser6",
      nickname: "생성유저6",
    });

    mockAuth.mockResolvedValue({
      user: { id: user.id, role: "USER" },
    });

    const req = new NextRequest("http://localhost/api/stories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-valid-json{{{",
    });

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("응답에 chapters 배열 포함 (상세 형식)", async () => {
    const user = await createTestUser({
      loginId: "createuser7",
      nickname: "생성유저7",
    });

    mockAuth.mockResolvedValue({
      user: { id: user.id, role: "USER" },
    });

    const req = makePostRequest({
      title: "챕터확인 스토리",
      genre: ["판타지"],
    });

    const res = await POST(req);
    const body = await res.json();

    expect(body).toHaveProperty("chapters");
    expect(Array.isArray(body.chapters)).toBe(true);
    // 생성 직후 챕터는 없음
    expect(body.chapters).toHaveLength(0);
  });
});
