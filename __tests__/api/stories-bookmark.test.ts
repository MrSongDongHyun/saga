// app/api/stories/[id]/bookmark/route.ts 통합 테스트
// POST   /api/stories/[id]/bookmark — 북마크 토글 (없으면 추가, 있으면 제거)
// DELETE /api/stories/[id]/bookmark — 북마크 강제 제거
//
// app/api/users/me/bookmarks/route.ts 통합 테스트
// GET /api/users/me/bookmarks — 내 북마크 목록
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
import { POST, DELETE } from "@/app/api/stories/[id]/bookmark/route";
import { GET as getBookmarks } from "@/app/api/users/me/bookmarks/route";

// ─────────────────────────────────────────────
// 요청 생성 헬퍼
// ─────────────────────────────────────────────

/** context.params를 Promise로 래핑 */
function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

/** NextRequest 생성 (body 불필요, method만 지정) */
function makeRequest(method: string, storyId: string): NextRequest {
  return new NextRequest(`http://localhost/api/stories/${storyId}/bookmark`, {
    method,
  });
}

/** GET /api/users/me/bookmarks 요청 생성 (쿼리 파라미터 포함) */
function makeGetRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL("http://localhost/api/users/me/bookmarks");
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  return new NextRequest(url.toString(), { method: "GET" });
}

// ─────────────────────────────────────────────
// DB 픽스처 헬퍼
// ─────────────────────────────────────────────

let userCounter = 0;

/** 테스트용 사용자 DB 생성 헬퍼 */
async function createUser(role = "USER") {
  userCounter++;
  return getTestPrisma().user.create({
    data: {
      loginId: `bmuser${userCounter}`,
      password: "hashed",
      nickname: `북마크유저${userCounter}`,
      role,
    },
  });
}

/** 테스트용 스토리 DB 생성 헬퍼 */
async function createStory(authorId: string, title = "테스트 스토리") {
  return getTestPrisma().story.create({
    data: {
      title,
      genre: '["판타지"]',
      tags: "[]",
      authorId,
    },
  });
}

// ─────────────────────────────────────────────
// beforeEach: mock 초기화 + counter 리셋
// ─────────────────────────────────────────────
beforeEach(() => {
  vi.clearAllMocks();
  userCounter = 0;
  // 기본: 미인증 상태
  mockAuth.mockResolvedValue(null);
});

// ─────────────────────────────────────────────
// POST /api/stories/[id]/bookmark — 북마크 토글
// ─────────────────────────────────────────────
describe("POST /api/stories/[id]/bookmark (북마크 토글)", () => {
  it("미인증 → 401", async () => {
    mockAuth.mockResolvedValue(null);

    const author = await createUser();
    const story = await createStory(author.id);

    const req = makeRequest("POST", story.id);
    const res = await POST(req, makeContext(story.id));

    expect(res.status).toBe(401);
  });

  it("존재하지 않는 스토리 ID → 404", async () => {
    const user = await createUser();
    mockAuth.mockResolvedValue({ user: { id: user.id, role: "USER" } });

    const req = makeRequest("POST", "nonexistent-bm-id-xyz");
    const res = await POST(req, makeContext("nonexistent-bm-id-xyz"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("북마크 없는 상태에서 POST → 200, bookmarked:true, bookmarkCount:1", async () => {
    const author = await createUser();
    const reader = await createUser();
    const story = await createStory(author.id);

    mockAuth.mockResolvedValue({ user: { id: reader.id, role: "USER" } });

    const req = makeRequest("POST", story.id);
    const res = await POST(req, makeContext(story.id));

    // 구현은 status 미지정 → 기본 200
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bookmarked).toBe(true);
    expect(body.bookmarkCount).toBe(1);

    // DB 실제 저장 확인
    const saved = await getTestPrisma().bookmark.findUnique({
      where: { userId_storyId: { userId: reader.id, storyId: story.id } },
    });
    expect(saved).not.toBeNull();
  });

  it("이미 북마크 상태에서 POST → 200, bookmarked:false, bookmarkCount:0 (토글 제거)", async () => {
    const author = await createUser();
    const reader = await createUser();
    const story = await createStory(author.id);

    // 미리 북마크 DB에 직접 삽입
    await getTestPrisma().bookmark.create({
      data: { userId: reader.id, storyId: story.id },
    });

    mockAuth.mockResolvedValue({ user: { id: reader.id, role: "USER" } });

    const req = makeRequest("POST", story.id);
    const res = await POST(req, makeContext(story.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bookmarked).toBe(false);
    expect(body.bookmarkCount).toBe(0);

    // DB 삭제 확인
    const deleted = await getTestPrisma().bookmark.findUnique({
      where: { userId_storyId: { userId: reader.id, storyId: story.id } },
    });
    expect(deleted).toBeNull();
  });
});

// ─────────────────────────────────────────────
// DELETE /api/stories/[id]/bookmark — 북마크 강제 제거
// ─────────────────────────────────────────────
describe("DELETE /api/stories/[id]/bookmark (북마크 강제 제거)", () => {
  it("미인증 → 401", async () => {
    mockAuth.mockResolvedValue(null);

    const author = await createUser();
    const story = await createStory(author.id);

    const req = makeRequest("DELETE", story.id);
    const res = await DELETE(req, makeContext(story.id));

    expect(res.status).toBe(401);
  });

  it("북마크 없는 상태에서 DELETE → 400", async () => {
    const author = await createUser();
    const user = await createUser();
    const story = await createStory(author.id);

    mockAuth.mockResolvedValue({ user: { id: user.id, role: "USER" } });

    const req = makeRequest("DELETE", story.id);
    const res = await DELETE(req, makeContext(story.id));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("북마크 있는 상태에서 DELETE → 200, bookmarked:false", async () => {
    const author = await createUser();
    const reader = await createUser();
    const story = await createStory(author.id);

    // 미리 북마크 DB에 직접 삽입
    await getTestPrisma().bookmark.create({
      data: { userId: reader.id, storyId: story.id },
    });

    mockAuth.mockResolvedValue({ user: { id: reader.id, role: "USER" } });

    const req = makeRequest("DELETE", story.id);
    const res = await DELETE(req, makeContext(story.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bookmarked).toBe(false);

    // DB 삭제 확인
    const deleted = await getTestPrisma().bookmark.findUnique({
      where: { userId_storyId: { userId: reader.id, storyId: story.id } },
    });
    expect(deleted).toBeNull();
  });
});

// ─────────────────────────────────────────────
// GET /api/users/me/bookmarks — 내 북마크 목록
// ─────────────────────────────────────────────
describe("GET /api/users/me/bookmarks (내 북마크 목록)", () => {
  it("미인증 → 401", async () => {
    mockAuth.mockResolvedValue(null);

    const req = makeGetRequest();
    const res = await getBookmarks(req);

    expect(res.status).toBe(401);
  });

  it("북마크 없을 때 → 200, bookmarks:[], pagination 포함", async () => {
    const user = await createUser();
    mockAuth.mockResolvedValue({ user: { id: user.id, role: "USER" } });

    const req = makeGetRequest();
    const res = await getBookmarks(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bookmarks).toEqual([]);
    expect(body).toHaveProperty("pagination");
    expect(body.pagination.total).toBe(0);
    expect(body.pagination.totalPages).toBe(0);
    expect(body.pagination.page).toBe(1);
  });

  it("북마크 2개 → 200, bookmarks 길이 2, story 포함", async () => {
    const author = await createUser();
    const reader = await createUser();

    const story1 = await createStory(author.id, "스토리 A");
    const story2 = await createStory(author.id, "스토리 B");

    await getTestPrisma().bookmark.create({
      data: { userId: reader.id, storyId: story1.id },
    });
    await getTestPrisma().bookmark.create({
      data: { userId: reader.id, storyId: story2.id },
    });

    mockAuth.mockResolvedValue({ user: { id: reader.id, role: "USER" } });

    const req = makeGetRequest();
    const res = await getBookmarks(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bookmarks).toHaveLength(2);
    expect(body.pagination.total).toBe(2);

    // 각 항목에 story 필드 포함 확인
    for (const item of body.bookmarks) {
      expect(item).toHaveProperty("id");
      expect(item).toHaveProperty("storyId");
      expect(item).toHaveProperty("createdAt");
      expect(item).toHaveProperty("story");
      expect(item.story).toHaveProperty("title");
    }
  });

  it("페이지네이션 — limit=1, page=2 → 두 번째 항목 반환", async () => {
    const author = await createUser();
    const reader = await createUser();

    // 두 스토리를 순서대로 생성하고 순서 보장을 위해 약간 시간차를 둠
    const story1 = await createStory(author.id, "첫 번째 스토리");
    // createdAt 차이를 DB에 반영하기 위해 북마크 생성 순서를 맞춤
    await getTestPrisma().bookmark.create({
      data: { userId: reader.id, storyId: story1.id },
    });

    const story2 = await createStory(author.id, "두 번째 스토리");
    await getTestPrisma().bookmark.create({
      data: { userId: reader.id, storyId: story2.id },
    });

    mockAuth.mockResolvedValue({ user: { id: reader.id, role: "USER" } });

    // page=1, limit=1 → 최신 북마크 1개 (story2)
    const resPage1 = await getBookmarks(makeGetRequest({ page: "1", limit: "1" }));
    const bodyPage1 = await resPage1.json();
    expect(resPage1.status).toBe(200);
    expect(bodyPage1.bookmarks).toHaveLength(1);
    expect(bodyPage1.pagination.page).toBe(1);
    expect(bodyPage1.pagination.totalPages).toBe(2);

    // page=2, limit=1 → 두 번째 북마크 (story1)
    const resPage2 = await getBookmarks(makeGetRequest({ page: "2", limit: "1" }));
    const bodyPage2 = await resPage2.json();
    expect(resPage2.status).toBe(200);
    expect(bodyPage2.bookmarks).toHaveLength(1);
    expect(bodyPage2.pagination.page).toBe(2);

    // 두 페이지의 항목이 서로 다른 storyId를 가짐
    expect(bodyPage1.bookmarks[0].storyId).not.toBe(bodyPage2.bookmarks[0].storyId);
  });

  it("다른 사용자의 북마크는 미포함 — 자신의 북마크만 반환", async () => {
    const author = await createUser();
    const reader = await createUser();
    const other = await createUser();

    const story1 = await createStory(author.id, "나의 스토리");
    const story2 = await createStory(author.id, "타인의 스토리");

    // reader 의 북마크
    await getTestPrisma().bookmark.create({
      data: { userId: reader.id, storyId: story1.id },
    });
    // other 의 북마크 (reader 목록에 나오면 안 됨)
    await getTestPrisma().bookmark.create({
      data: { userId: other.id, storyId: story2.id },
    });

    mockAuth.mockResolvedValue({ user: { id: reader.id, role: "USER" } });

    const req = makeGetRequest();
    const res = await getBookmarks(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    // reader 북마크는 1개만
    expect(body.bookmarks).toHaveLength(1);
    expect(body.pagination.total).toBe(1);
    expect(body.bookmarks[0].storyId).toBe(story1.id);
  });
});
