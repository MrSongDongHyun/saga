// app/api/stories/[id]/like/route.ts 통합 테스트
// POST   /api/stories/[id]/like — 좋아요 토글 (없으면 추가, 있으면 제거)
// DELETE /api/stories/[id]/like — 좋아요 강제 제거
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
import { POST, DELETE } from "@/app/api/stories/[id]/like/route";

// ─────────────────────────────────────────────
// 요청 생성 헬퍼
// ─────────────────────────────────────────────

/** context.params를 Promise로 래핑 */
function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

/** NextRequest 생성 (body 불필요, method만 지정) */
function makeRequest(method: string, storyId: string): NextRequest {
  return new NextRequest(`http://localhost/api/stories/${storyId}/like`, {
    method,
  });
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
      loginId: `likeuser${userCounter}`,
      password: "hashed",
      nickname: `좋아요유저${userCounter}`,
      role,
    },
  });
}

/** 테스트용 스토리 DB 생성 헬퍼 */
async function createStory(authorId: string) {
  return getTestPrisma().story.create({
    data: {
      title: "테스트 스토리",
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
// POST /api/stories/[id]/like — 좋아요 토글
// ─────────────────────────────────────────────
describe("POST /api/stories/[id]/like (좋아요 토글)", () => {
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

    const req = makeRequest("POST", "nonexistent-like-id-xyz");
    const res = await POST(req, makeContext("nonexistent-like-id-xyz"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("좋아요 없는 상태에서 POST → 200, liked:true, likeCount:1", async () => {
    const author = await createUser();
    const liker = await createUser();
    const story = await createStory(author.id);

    mockAuth.mockResolvedValue({ user: { id: liker.id, role: "USER" } });

    const req = makeRequest("POST", story.id);
    const res = await POST(req, makeContext(story.id));

    // 구현은 status 미지정 → 기본 200
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.liked).toBe(true);
    expect(body.likeCount).toBe(1);
  });

  it("이미 좋아요 상태에서 POST → 200, liked:false, likeCount:0 (토글 제거)", async () => {
    const author = await createUser();
    const liker = await createUser();
    const story = await createStory(author.id);

    // 미리 좋아요 DB에 직접 삽입
    await getTestPrisma().like.create({
      data: { userId: liker.id, storyId: story.id },
    });

    mockAuth.mockResolvedValue({ user: { id: liker.id, role: "USER" } });

    const req = makeRequest("POST", story.id);
    const res = await POST(req, makeContext(story.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.liked).toBe(false);
    expect(body.likeCount).toBe(0);
  });

  it("다른 사용자가 좋아요해도 각자 독립 — likeCount 합산", async () => {
    const author = await createUser();
    const liker1 = await createUser();
    const liker2 = await createUser();
    const story = await createStory(author.id);

    // liker1 좋아요
    await getTestPrisma().like.create({
      data: { userId: liker1.id, storyId: story.id },
    });

    // liker2 가 POST (추가)
    mockAuth.mockResolvedValue({ user: { id: liker2.id, role: "USER" } });

    const req = makeRequest("POST", story.id);
    const res = await POST(req, makeContext(story.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    // liker1(1) + liker2(1) = 2
    expect(body.liked).toBe(true);
    expect(body.likeCount).toBe(2);

    // liker1은 여전히 자신의 좋아요가 존재
    const liker1Like = await getTestPrisma().like.findUnique({
      where: { userId_storyId: { userId: liker1.id, storyId: story.id } },
    });
    expect(liker1Like).not.toBeNull();
  });
});

// ─────────────────────────────────────────────
// DELETE /api/stories/[id]/like — 좋아요 강제 제거
// ─────────────────────────────────────────────
describe("DELETE /api/stories/[id]/like (좋아요 강제 제거)", () => {
  it("미인증 → 401", async () => {
    mockAuth.mockResolvedValue(null);

    const author = await createUser();
    const story = await createStory(author.id);

    const req = makeRequest("DELETE", story.id);
    const res = await DELETE(req, makeContext(story.id));

    expect(res.status).toBe(401);
  });

  it("존재하지 않는 스토리 ID → 404", async () => {
    const user = await createUser();
    mockAuth.mockResolvedValue({ user: { id: user.id, role: "USER" } });

    const req = makeRequest("DELETE", "nonexistent-like-del-xyz");
    const res = await DELETE(req, makeContext("nonexistent-like-del-xyz"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("좋아요 없는 상태에서 DELETE → 400 '좋아요한 스토리가 아닙니다.'", async () => {
    const author = await createUser();
    const user = await createUser();
    const story = await createStory(author.id);

    mockAuth.mockResolvedValue({ user: { id: user.id, role: "USER" } });

    const req = makeRequest("DELETE", story.id);
    const res = await DELETE(req, makeContext(story.id));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("좋아요한 스토리가 아닙니다.");
  });

  it("좋아요 있는 상태에서 DELETE → 200, liked:false, likeCount:0", async () => {
    const author = await createUser();
    const liker = await createUser();
    const story = await createStory(author.id);

    // 미리 좋아요 DB에 직접 삽입
    await getTestPrisma().like.create({
      data: { userId: liker.id, storyId: story.id },
    });

    mockAuth.mockResolvedValue({ user: { id: liker.id, role: "USER" } });

    const req = makeRequest("DELETE", story.id);
    const res = await DELETE(req, makeContext(story.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.liked).toBe(false);
    expect(body.likeCount).toBe(0);

    // DB에서 실제 삭제 확인
    const deleted = await getTestPrisma().like.findUnique({
      where: { userId_storyId: { userId: liker.id, storyId: story.id } },
    });
    expect(deleted).toBeNull();
  });
});
