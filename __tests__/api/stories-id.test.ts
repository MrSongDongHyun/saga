// app/api/stories/[id]/route.ts 통합 테스트
// GET    /api/stories/[id]  — 상세 조회
// PUT    /api/stories/[id]  — 수정 (소유자 또는 ADMIN)
// DELETE /api/stories/[id]  — 삭제 (소유자 또는 ADMIN)
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getTestPrisma } from "../setup";

// ── auth() 모킹 ────────────────────────────────────────────────
// NextAuth 실제 호출 차단 (세션 없이 테스트 가능하도록)
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
const mockAuth = auth as ReturnType<typeof vi.fn>;

// ── [id] 라우트 핸들러 ─────────────────────────────────────────
import { GET, PUT, DELETE } from "@/app/api/stories/[id]/route";

// ─────────────────────────────────────────────
// 요청 생성 헬퍼
// ─────────────────────────────────────────────

/** NextRequest 생성 (body 선택적) */
function makeRequest(
  method: string,
  url: string,
  body?: unknown
): NextRequest {
  return new NextRequest(url, {
    method,
    headers: body ? { "content-type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

/** context.params를 Promise로 래핑 */
function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ─────────────────────────────────────────────
// DB 픽스처 헬퍼
// ─────────────────────────────────────────────

/** 테스트용 사용자 DB 생성 헬퍼 */
async function createUser(
  overrides: Partial<{
    loginId: string;
    password: string;
    nickname: string;
    role: string;
  }> = {}
) {
  const prisma = getTestPrisma();
  return prisma.user.create({
    data: {
      loginId:  overrides.loginId  ?? `user_${Date.now()}_${Math.random()}`,
      password: overrides.password ?? "hashed_password",
      nickname: overrides.nickname ?? `nick_${Date.now()}_${Math.random()}`,
      role:     overrides.role     ?? "USER",
    },
  });
}

/** 테스트용 스토리 DB 생성 헬퍼 */
async function createStory(
  authorId: string,
  overrides: Partial<{
    title:      string;
    status:     string;
    visibility: string;
    genre:      string;
    tags:       string;
  }> = {}
) {
  const prisma = getTestPrisma();
  return prisma.story.create({
    data: {
      title:      overrides.title      ?? `스토리_${Date.now()}_${Math.random()}`,
      genre:      overrides.genre      ?? '["판타지"]',
      tags:       overrides.tags       ?? "[]",
      status:     overrides.status     ?? "ONGOING",
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
  // 기본: 미인증 상태
  mockAuth.mockResolvedValue(null);
});

// ─────────────────────────────────────────────
// GET /api/stories/[id]
// ─────────────────────────────────────────────
describe("GET /api/stories/[id]", () => {
  it("존재하는 PUBLIC 스토리 조회 → 200, id 포함, viewCount +1 확인", async () => {
    const prisma = getTestPrisma();
    const author = await createUser({ loginId: "getuser1", nickname: "조회유저1" });
    const story  = await createStory(author.id, {
      title:      "공개 스토리",
      visibility: "PUBLIC",
    });

    const req = makeRequest("GET", `http://localhost/api/stories/${story.id}`);
    const res = await GET(req, makeContext(story.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(story.id);
    expect(body.title).toBe("공개 스토리");

    // viewCount +1 확인 (DB에 반영된 값)
    const updated = await prisma.story.findUnique({ where: { id: story.id } });
    expect(updated!.viewCount).toBe(1);
  });

  it("존재하지 않는 ID 조회 → 404", async () => {
    const req = makeRequest("GET", "http://localhost/api/stories/nonexistent-id-xyz");
    const res = await GET(req, makeContext("nonexistent-id-xyz"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("PRIVATE 스토리를 소유자(auth mock)가 조회 → 200", async () => {
    const owner = await createUser({ loginId: "getuser2", nickname: "소유자유저" });
    const story = await createStory(owner.id, {
      title:      "비공개 스토리",
      visibility: "PRIVATE",
    });

    // 소유자로 auth mock 설정
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("GET", `http://localhost/api/stories/${story.id}`);
    const res = await GET(req, makeContext(story.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(story.id);
  });

  it("PRIVATE 스토리를 비소유자가 조회 → 404 (존재 노출 방지)", async () => {
    const owner  = await createUser({ loginId: "getuser3", nickname: "소유자유저2" });
    const other  = await createUser({ loginId: "getuser4", nickname: "타인유저1" });
    const story  = await createStory(owner.id, {
      title:      "비공개 스토리2",
      visibility: "PRIVATE",
    });

    // 타인으로 auth mock 설정
    mockAuth.mockResolvedValue({ user: { id: other.id, role: "USER" } });

    const req = makeRequest("GET", `http://localhost/api/stories/${story.id}`);
    const res = await GET(req, makeContext(story.id));

    expect(res.status).toBe(404);
  });

  it("PRIVATE 스토리를 ADMIN이 조회 → 200", async () => {
    const owner = await createUser({ loginId: "getuser5", nickname: "소유자유저3" });
    const admin = await createUser({ loginId: "adminuser1", nickname: "관리자유저", role: "ADMIN" });
    const story = await createStory(owner.id, {
      title:      "ADMIN 조회 테스트",
      visibility: "PRIVATE",
    });

    // ADMIN으로 auth mock 설정
    mockAuth.mockResolvedValue({ user: { id: admin.id, role: "ADMIN" } });

    const req = makeRequest("GET", `http://localhost/api/stories/${story.id}`);
    const res = await GET(req, makeContext(story.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(story.id);
  });

  it("로그인 사용자가 조회 시 isLiked/isBookmarked 포함", async () => {
    const author = await createUser({ loginId: "getuser6", nickname: "저자유저" });
    const reader = await createUser({ loginId: "getuser7", nickname: "독자유저" });
    const story  = await createStory(author.id, {
      title:      "좋아요 확인 스토리",
      visibility: "PUBLIC",
    });

    // 독자로 auth mock 설정
    mockAuth.mockResolvedValue({ user: { id: reader.id, role: "USER" } });

    const req = makeRequest("GET", `http://localhost/api/stories/${story.id}`);
    const res = await GET(req, makeContext(story.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    // 좋아요/북마크 없는 상태 → false
    expect(body).toHaveProperty("isLiked");
    expect(body).toHaveProperty("isBookmarked");
    expect(body.isLiked).toBe(false);
    expect(body.isBookmarked).toBe(false);
  });
});

// ─────────────────────────────────────────────
// PUT /api/stories/[id]
// ─────────────────────────────────────────────
describe("PUT /api/stories/[id]", () => {
  it("미인증 → 401", async () => {
    // auth()가 null 반환 → requireAuth()가 401 throw
    mockAuth.mockResolvedValue(null);

    const author = await createUser({ loginId: "putuser1", nickname: "수정유저1" });
    const story  = await createStory(author.id, { title: "수정 대상 스토리1" });

    const req = makeRequest(
      "PUT",
      `http://localhost/api/stories/${story.id}`,
      { title: "수정된 제목" }
    );
    const res = await PUT(req, makeContext(story.id));

    expect(res.status).toBe(401);
  });

  it("존재하지 않는 ID 수정 → 404", async () => {
    const user = await createUser({ loginId: "putuser2", nickname: "수정유저2" });
    mockAuth.mockResolvedValue({ user: { id: user.id, role: "USER" } });

    const req = makeRequest(
      "PUT",
      "http://localhost/api/stories/nonexistent-id-put",
      { title: "수정된 제목" }
    );
    const res = await PUT(req, makeContext("nonexistent-id-put"));

    expect(res.status).toBe(404);
  });

  it("소유자 수정 성공 → 200, 변경된 title 확인", async () => {
    const owner = await createUser({ loginId: "putuser3", nickname: "수정유저3" });
    const story = await createStory(owner.id, { title: "원래 제목" });

    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest(
      "PUT",
      `http://localhost/api/stories/${story.id}`,
      { title: "변경된 제목" }
    );
    const res = await PUT(req, makeContext(story.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("변경된 제목");
    expect(body.id).toBe(story.id);
  });

  it("비소유자 수정 시도 → 403", async () => {
    const owner = await createUser({ loginId: "putuser4", nickname: "수정유저4" });
    const other = await createUser({ loginId: "putuser5", nickname: "수정유저5" });
    const story = await createStory(owner.id, { title: "수정 불가 스토리" });

    // 타인으로 auth mock 설정
    mockAuth.mockResolvedValue({ user: { id: other.id, role: "USER" } });

    const req = makeRequest(
      "PUT",
      `http://localhost/api/stories/${story.id}`,
      { title: "무단 수정 시도" }
    );
    const res = await PUT(req, makeContext(story.id));

    expect(res.status).toBe(403);
  });

  it("빈 body 전달 → 200 (변경 없이 성공)", async () => {
    const owner = await createUser({ loginId: "putuser6", nickname: "수정유저6" });
    const story = await createStory(owner.id, { title: "변경 없는 스토리" });

    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    // 빈 객체 전달 — 아무 필드도 변경하지 않음
    const req = makeRequest(
      "PUT",
      `http://localhost/api/stories/${story.id}`,
      {}
    );
    const res = await PUT(req, makeContext(story.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    // 제목이 그대로 유지됨
    expect(body.title).toBe("변경 없는 스토리");
  });

  it("유효성 오류 (title 빈 문자열) → 400", async () => {
    const owner = await createUser({ loginId: "putuser7", nickname: "수정유저7" });
    const story = await createStory(owner.id, { title: "유효성 오류 테스트" });

    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    // title 빈 문자열은 validateStoryUpdate에서 400 throw
    const req = makeRequest(
      "PUT",
      `http://localhost/api/stories/${story.id}`,
      { title: "" }
    );
    const res = await PUT(req, makeContext(story.id));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });
});

// ─────────────────────────────────────────────
// DELETE /api/stories/[id]
// ─────────────────────────────────────────────
describe("DELETE /api/stories/[id]", () => {
  it("미인증 → 401", async () => {
    mockAuth.mockResolvedValue(null);

    const author = await createUser({ loginId: "deluser1", nickname: "삭제유저1" });
    const story  = await createStory(author.id, { title: "삭제 대상 스토리1" });

    const req = makeRequest("DELETE", `http://localhost/api/stories/${story.id}`);
    const res = await DELETE(req, makeContext(story.id));

    expect(res.status).toBe(401);
  });

  it("존재하지 않는 ID 삭제 → 404", async () => {
    const user = await createUser({ loginId: "deluser2", nickname: "삭제유저2" });
    mockAuth.mockResolvedValue({ user: { id: user.id, role: "USER" } });

    const req = makeRequest("DELETE", "http://localhost/api/stories/nonexistent-id-del");
    const res = await DELETE(req, makeContext("nonexistent-id-del"));

    expect(res.status).toBe(404);
  });

  it("소유자 삭제 → 200, DB에서 실제 삭제 확인", async () => {
    const prisma = getTestPrisma();
    const owner  = await createUser({ loginId: "deluser3", nickname: "삭제유저3" });
    const story  = await createStory(owner.id, { title: "실제 삭제 스토리" });

    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("DELETE", `http://localhost/api/stories/${story.id}`);
    const res = await DELETE(req, makeContext(story.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("message");

    // DB에서 실제 삭제 확인
    const deleted = await prisma.story.findUnique({ where: { id: story.id } });
    expect(deleted).toBeNull();
  });

  it("비소유자 삭제 시도 → 403", async () => {
    const owner = await createUser({ loginId: "deluser4", nickname: "삭제유저4" });
    const other = await createUser({ loginId: "deluser5", nickname: "삭제유저5" });
    const story = await createStory(owner.id, { title: "삭제 불가 스토리" });

    // 타인으로 auth mock 설정
    mockAuth.mockResolvedValue({ user: { id: other.id, role: "USER" } });

    const req = makeRequest("DELETE", `http://localhost/api/stories/${story.id}`);
    const res = await DELETE(req, makeContext(story.id));

    expect(res.status).toBe(403);

    // DB에서 스토리가 삭제되지 않았는지 확인
    const prisma    = getTestPrisma();
    const stillExists = await prisma.story.findUnique({ where: { id: story.id } });
    expect(stillExists).not.toBeNull();
  });
});
