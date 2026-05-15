// app/api/stories/[id]/chapters 통합 테스트
// GET  /api/stories/[id]/chapters           — 챕터 목록
// POST /api/stories/[id]/chapters           — 챕터 생성
// GET  /api/stories/[id]/chapters/[id]      — 챕터 상세
// PUT  /api/stories/[id]/chapters/[id]      — 챕터 수정
// DELETE /api/stories/[id]/chapters/[id]    — 챕터 삭제
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getTestPrisma } from "../setup";

// ── auth() 모킹 ────────────────────────────────────────────────
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

import { auth } from "@/lib/auth";
const mockAuth = auth as ReturnType<typeof vi.fn>;

// ── 라우트 핸들러 ─────────────────────────────────────────────
import {
  GET as getChapters,
  POST as postChapter,
} from "@/app/api/stories/[id]/chapters/route";
import {
  GET as getChapter,
  PUT as putChapter,
  DELETE as deleteChapter,
} from "@/app/api/stories/[id]/chapters/[chapterId]/route";

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

/** 스토리 ID context (목록/생성용) */
function makeStoryContext(storyId: string) {
  return { params: Promise.resolve({ id: storyId }) };
}

/** 스토리 ID + 챕터 ID context (상세/수정/삭제용) */
function makeChapterContext(storyId: string, chapterId: string) {
  return { params: Promise.resolve({ id: storyId, chapterId }) };
}

// ─────────────────────────────────────────────
// DB 픽스처 헬퍼
// ─────────────────────────────────────────────

async function createUser(
  overrides: Partial<{
    loginId: string;
    nickname: string;
    role: string;
  }> = {}
) {
  const prisma = getTestPrisma();
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  return prisma.user.create({
    data: {
      loginId:  overrides.loginId  ?? `user_${suffix}`,
      password: "hashed_password",
      nickname: overrides.nickname ?? `nick_${suffix}`,
      role:     overrides.role     ?? "USER",
    },
  });
}

async function createStory(
  authorId: string,
  overrides: Partial<{
    title:      string;
    visibility: string;
  }> = {}
) {
  const prisma = getTestPrisma();
  return prisma.story.create({
    data: {
      title:      overrides.title      ?? `스토리_${Date.now()}`,
      genre:      '["판타지"]',
      tags:       "[]",
      status:     "ONGOING",
      visibility: overrides.visibility ?? "PUBLIC",
      authorId,
    },
  });
}

async function createChapter(
  storyId: string,
  overrides: Partial<{
    title:       string;
    content:     string;
    orderIndex:  number;
    isPublished: boolean;
  }> = {}
) {
  const prisma = getTestPrisma();
  return prisma.chapter.create({
    data: {
      storyId,
      title:       overrides.title       ?? `챕터_${Date.now()}`,
      content:     overrides.content     ?? "챕터 내용입니다.",
      orderIndex:  overrides.orderIndex  ?? 1,
      isPublished: overrides.isPublished ?? true,
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
// GET /api/stories/[id]/chapters
// ─────────────────────────────────────────────
describe("GET /api/stories/[id]/chapters", () => {
  it("비소유자는 미발행 챕터를 받지 못한다", async () => {
    const owner = await createUser({ loginId: "chl_get_owner1", nickname: "목록소유자1" });
    const story = await createStory(owner.id);

    await createChapter(story.id, { title: "발행됨", orderIndex: 1, isPublished: true });
    await createChapter(story.id, { title: "미발행", orderIndex: 2, isPublished: false });

    // 비로그인 상태
    const req = makeRequest("GET", `http://localhost/api/stories/${story.id}/chapters`);
    const res = await getChapters(req, makeStoryContext(story.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chapters).toHaveLength(1);
    expect(body.chapters[0].title).toBe("발행됨");
  });

  it("소유자는 미발행 챕터 포함 전체 반환", async () => {
    const owner = await createUser({ loginId: "chl_get_owner2", nickname: "목록소유자2" });
    const story = await createStory(owner.id);

    await createChapter(story.id, { title: "발행됨", orderIndex: 1, isPublished: true });
    await createChapter(story.id, { title: "미발행", orderIndex: 2, isPublished: false });

    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("GET", `http://localhost/api/stories/${story.id}/chapters`);
    const res = await getChapters(req, makeStoryContext(story.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chapters).toHaveLength(2);
  });

  it("orderIndex 오름차순 정렬 확인", async () => {
    const owner = await createUser({ loginId: "chl_get_order", nickname: "정렬테스트" });
    const story = await createStory(owner.id);

    await createChapter(story.id, { title: "3화", orderIndex: 3, isPublished: true });
    await createChapter(story.id, { title: "1화", orderIndex: 1, isPublished: true });
    await createChapter(story.id, { title: "2화", orderIndex: 2, isPublished: true });

    const req = makeRequest("GET", `http://localhost/api/stories/${story.id}/chapters`);
    const res = await getChapters(req, makeStoryContext(story.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    const indices = body.chapters.map((ch: { orderIndex: number }) => ch.orderIndex);
    expect(indices).toEqual([1, 2, 3]);
  });

  it("존재하지 않는 스토리 → 404", async () => {
    const req = makeRequest("GET", "http://localhost/api/stories/nonexistent/chapters");
    const res = await getChapters(req, makeStoryContext("nonexistent"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("ADMIN은 미발행 챕터 포함 전체 반환", async () => {
    const owner = await createUser({ loginId: "chl_get_owner3", nickname: "목록소유자3" });
    const admin = await createUser({ loginId: "chl_get_admin1", nickname: "관리자1", role: "ADMIN" });
    const story = await createStory(owner.id);

    await createChapter(story.id, { title: "발행됨", orderIndex: 1, isPublished: true });
    await createChapter(story.id, { title: "미발행", orderIndex: 2, isPublished: false });

    mockAuth.mockResolvedValue({ user: { id: admin.id, role: "ADMIN" } });

    const req = makeRequest("GET", `http://localhost/api/stories/${story.id}/chapters`);
    const res = await getChapters(req, makeStoryContext(story.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.chapters).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────
// POST /api/stories/[id]/chapters
// ─────────────────────────────────────────────
describe("POST /api/stories/[id]/chapters", () => {
  it("미인증 → 401", async () => {
    const owner = await createUser({ loginId: "chl_post_unauth", nickname: "생성미인증" });
    const story = await createStory(owner.id);

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/chapters`, {
      title: "새 챕터",
      content: "내용입니다.",
    });
    const res = await postChapter(req, makeStoryContext(story.id));

    expect(res.status).toBe(401);
  });

  it("비소유자 → 403", async () => {
    const owner = await createUser({ loginId: "chl_post_owner1", nickname: "생성소유자1" });
    const other = await createUser({ loginId: "chl_post_other1", nickname: "생성타인1" });
    const story = await createStory(owner.id);

    mockAuth.mockResolvedValue({ user: { id: other.id, role: "USER" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/chapters`, {
      title: "무단 생성 시도",
      content: "내용",
    });
    const res = await postChapter(req, makeStoryContext(story.id));

    expect(res.status).toBe(403);
  });

  it("유효 입력 → 201, orderIndex 자동 설정 확인", async () => {
    const prisma = getTestPrisma();
    const owner = await createUser({ loginId: "chl_post_owner2", nickname: "생성소유자2" });
    const story = await createStory(owner.id);

    // 기존 챕터 2개 미리 생성
    await createChapter(story.id, { orderIndex: 1 });
    await createChapter(story.id, { orderIndex: 2 });

    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/chapters`, {
      title: "자동 순서 챕터",
      content: "본문 내용",
    });
    const res = await postChapter(req, makeStoryContext(story.id));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe("자동 순서 챕터");
    // 기존 2개 + 1 = orderIndex 3
    expect(body.orderIndex).toBe(3);
    expect(body).toHaveProperty("content");

    // DB 확인
    const created = await prisma.chapter.findUnique({ where: { id: body.id } });
    expect(created).not.toBeNull();
    expect(created!.orderIndex).toBe(3);
  });

  it("title 201자 → 400", async () => {
    const owner = await createUser({ loginId: "chl_post_vld1", nickname: "유효성테스트1" });
    const story = await createStory(owner.id);

    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/chapters`, {
      title: "가".repeat(201),
      content: "내용",
    });
    const res = await postChapter(req, makeStoryContext(story.id));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body.field).toBe("title");
  });

  it("content 미제공 → 400", async () => {
    const owner = await createUser({ loginId: "chl_post_vld2", nickname: "유효성테스트2" });
    const story = await createStory(owner.id);

    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/chapters`, {
      title: "제목만",
    });
    const res = await postChapter(req, makeStoryContext(story.id));

    expect(res.status).toBe(400);
  });

  it("orderIndex 명시 시 해당 값으로 저장", async () => {
    const owner = await createUser({ loginId: "chl_post_order", nickname: "순서지정" });
    const story = await createStory(owner.id);

    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("POST", `http://localhost/api/stories/${story.id}/chapters`, {
      title: "순서 지정 챕터",
      content: "내용",
      orderIndex: 10,
    });
    const res = await postChapter(req, makeStoryContext(story.id));

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.orderIndex).toBe(10);
  });

  it("존재하지 않는 스토리 → 404", async () => {
    const user = await createUser({ loginId: "chl_post_404", nickname: "없는스토리" });
    mockAuth.mockResolvedValue({ user: { id: user.id, role: "USER" } });

    const req = makeRequest("POST", "http://localhost/api/stories/nonexistent/chapters", {
      title: "챕터",
      content: "내용",
    });
    const res = await postChapter(req, makeStoryContext("nonexistent"));

    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────
// GET /api/stories/[id]/chapters/[chapterId]
// ─────────────────────────────────────────────
describe("GET /api/stories/[id]/chapters/[chapterId]", () => {
  it("정상 조회 → 200, content 포함", async () => {
    const owner = await createUser({ loginId: "chl_gd_owner1", nickname: "상세소유자1" });
    const story = await createStory(owner.id);
    const chapter = await createChapter(story.id, {
      title: "상세 조회 챕터",
      content: "챕터 본문 내용입니다.",
      isPublished: true,
    });

    const req = makeRequest("GET", `http://localhost/api/stories/${story.id}/chapters/${chapter.id}`);
    const res = await getChapter(req, makeChapterContext(story.id, chapter.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(chapter.id);
    expect(body.title).toBe("상세 조회 챕터");
    expect(body.content).toBe("챕터 본문 내용입니다.");
  });

  it("미발행 챕터 비소유자 접근 → 404", async () => {
    const owner = await createUser({ loginId: "chl_gd_owner2", nickname: "상세소유자2" });
    const story = await createStory(owner.id);
    const chapter = await createChapter(story.id, {
      title: "미발행",
      isPublished: false,
    });

    // 비로그인 상태
    const req = makeRequest("GET", `http://localhost/api/stories/${story.id}/chapters/${chapter.id}`);
    const res = await getChapter(req, makeChapterContext(story.id, chapter.id));

    expect(res.status).toBe(404);
  });

  it("미발행 챕터 소유자 접근 → 200", async () => {
    const owner = await createUser({ loginId: "chl_gd_owner3", nickname: "상세소유자3" });
    const story = await createStory(owner.id);
    const chapter = await createChapter(story.id, {
      title: "소유자 미발행 조회",
      isPublished: false,
    });

    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("GET", `http://localhost/api/stories/${story.id}/chapters/${chapter.id}`);
    const res = await getChapter(req, makeChapterContext(story.id, chapter.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(chapter.id);
  });

  it("미발행 챕터 ADMIN 접근 → 200", async () => {
    const owner = await createUser({ loginId: "chl_gd_owner4", nickname: "상세소유자4" });
    const admin = await createUser({ loginId: "chl_gd_admin1", nickname: "상세관리자1", role: "ADMIN" });
    const story = await createStory(owner.id);
    const chapter = await createChapter(story.id, {
      title: "ADMIN 미발행 조회",
      isPublished: false,
    });

    mockAuth.mockResolvedValue({ user: { id: admin.id, role: "ADMIN" } });

    const req = makeRequest("GET", `http://localhost/api/stories/${story.id}/chapters/${chapter.id}`);
    const res = await getChapter(req, makeChapterContext(story.id, chapter.id));

    expect(res.status).toBe(200);
  });

  it("존재하지 않는 챕터 → 404", async () => {
    const owner = await createUser({ loginId: "chl_gd_404", nickname: "없는챕터" });
    const story = await createStory(owner.id);

    const req = makeRequest("GET", `http://localhost/api/stories/${story.id}/chapters/nonexistent`);
    const res = await getChapter(req, makeChapterContext(story.id, "nonexistent"));

    expect(res.status).toBe(404);
  });
});

// ─────────────────────────────────────────────
// PUT /api/stories/[id]/chapters/[chapterId]
// ─────────────────────────────────────────────
describe("PUT /api/stories/[id]/chapters/[chapterId]", () => {
  it("소유자 수정 → 200, title 변경 확인", async () => {
    const owner = await createUser({ loginId: "chl_put_owner1", nickname: "수정소유자1" });
    const story = await createStory(owner.id);
    const chapter = await createChapter(story.id, { title: "원래 제목" });

    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest(
      "PUT",
      `http://localhost/api/stories/${story.id}/chapters/${chapter.id}`,
      { title: "수정된 제목" }
    );
    const res = await putChapter(req, makeChapterContext(story.id, chapter.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("수정된 제목");
    expect(body.id).toBe(chapter.id);
  });

  it("비소유자 → 403", async () => {
    const owner = await createUser({ loginId: "chl_put_owner2", nickname: "수정소유자2" });
    const other = await createUser({ loginId: "chl_put_other1", nickname: "수정타인1" });
    const story = await createStory(owner.id);
    const chapter = await createChapter(story.id, { title: "수정 불가" });

    mockAuth.mockResolvedValue({ user: { id: other.id, role: "USER" } });

    const req = makeRequest(
      "PUT",
      `http://localhost/api/stories/${story.id}/chapters/${chapter.id}`,
      { title: "무단 수정" }
    );
    const res = await putChapter(req, makeChapterContext(story.id, chapter.id));

    expect(res.status).toBe(403);
  });

  it("미인증 → 401", async () => {
    const owner = await createUser({ loginId: "chl_put_unauth", nickname: "수정미인증" });
    const story = await createStory(owner.id);
    const chapter = await createChapter(story.id, { title: "수정 대상" });

    const req = makeRequest(
      "PUT",
      `http://localhost/api/stories/${story.id}/chapters/${chapter.id}`,
      { title: "수정 시도" }
    );
    const res = await putChapter(req, makeChapterContext(story.id, chapter.id));

    expect(res.status).toBe(401);
  });

  it("isPublished 변경 → DB 반영 확인", async () => {
    const prisma = getTestPrisma();
    const owner = await createUser({ loginId: "chl_put_pub", nickname: "발행수정" });
    const story = await createStory(owner.id);
    const chapter = await createChapter(story.id, { isPublished: false });

    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest(
      "PUT",
      `http://localhost/api/stories/${story.id}/chapters/${chapter.id}`,
      { isPublished: true }
    );
    const res = await putChapter(req, makeChapterContext(story.id, chapter.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isPublished).toBe(true);

    // DB 확인
    const updated = await prisma.chapter.findUnique({ where: { id: chapter.id } });
    expect(updated!.isPublished).toBe(true);
  });

  it("ADMIN이 타인 챕터 수정 → 200", async () => {
    const owner = await createUser({ loginId: "chl_put_owner3", nickname: "수정소유자3" });
    const admin = await createUser({ loginId: "chl_put_admin1", nickname: "수정관리자1", role: "ADMIN" });
    const story = await createStory(owner.id);
    const chapter = await createChapter(story.id, { title: "관리자 수정 대상" });

    mockAuth.mockResolvedValue({ user: { id: admin.id, role: "ADMIN" } });

    const req = makeRequest(
      "PUT",
      `http://localhost/api/stories/${story.id}/chapters/${chapter.id}`,
      { title: "관리자가 수정" }
    );
    const res = await putChapter(req, makeChapterContext(story.id, chapter.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("관리자가 수정");
  });
});

// ─────────────────────────────────────────────
// DELETE /api/stories/[id]/chapters/[chapterId]
// ─────────────────────────────────────────────
describe("DELETE /api/stories/[id]/chapters/[chapterId]", () => {
  it("소유자 삭제 → 200, DB 삭제 확인", async () => {
    const prisma = getTestPrisma();
    const owner = await createUser({ loginId: "chl_del_owner1", nickname: "삭제소유자1" });
    const story = await createStory(owner.id);
    const chapter = await createChapter(story.id, { title: "삭제 대상 챕터" });

    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest(
      "DELETE",
      `http://localhost/api/stories/${story.id}/chapters/${chapter.id}`
    );
    const res = await deleteChapter(req, makeChapterContext(story.id, chapter.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("message");
    expect(body.message).toBe("챕터가 삭제되었습니다.");

    // DB 삭제 확인
    const deleted = await prisma.chapter.findUnique({ where: { id: chapter.id } });
    expect(deleted).toBeNull();
  });

  it("비소유자 → 403", async () => {
    const prisma = getTestPrisma();
    const owner = await createUser({ loginId: "chl_del_owner2", nickname: "삭제소유자2" });
    const other = await createUser({ loginId: "chl_del_other1", nickname: "삭제타인1" });
    const story = await createStory(owner.id);
    const chapter = await createChapter(story.id, { title: "삭제 불가 챕터" });

    mockAuth.mockResolvedValue({ user: { id: other.id, role: "USER" } });

    const req = makeRequest(
      "DELETE",
      `http://localhost/api/stories/${story.id}/chapters/${chapter.id}`
    );
    const res = await deleteChapter(req, makeChapterContext(story.id, chapter.id));

    expect(res.status).toBe(403);

    // DB에 챕터가 여전히 존재하는지 확인
    const stillExists = await prisma.chapter.findUnique({ where: { id: chapter.id } });
    expect(stillExists).not.toBeNull();
  });

  it("미인증 → 401", async () => {
    const owner = await createUser({ loginId: "chl_del_unauth", nickname: "삭제미인증" });
    const story = await createStory(owner.id);
    const chapter = await createChapter(story.id, { title: "미인증 삭제 시도" });

    const req = makeRequest(
      "DELETE",
      `http://localhost/api/stories/${story.id}/chapters/${chapter.id}`
    );
    const res = await deleteChapter(req, makeChapterContext(story.id, chapter.id));

    expect(res.status).toBe(401);
  });

  it("존재하지 않는 챕터 삭제 → 404", async () => {
    const owner = await createUser({ loginId: "chl_del_404", nickname: "없는챕터삭제" });
    const story = await createStory(owner.id);

    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest(
      "DELETE",
      `http://localhost/api/stories/${story.id}/chapters/nonexistent`
    );
    const res = await deleteChapter(req, makeChapterContext(story.id, "nonexistent"));

    expect(res.status).toBe(404);
  });

  it("ADMIN이 타인 챕터 삭제 → 200", async () => {
    const prisma = getTestPrisma();
    const owner = await createUser({ loginId: "chl_del_owner3", nickname: "삭제소유자3" });
    const admin = await createUser({ loginId: "chl_del_admin1", nickname: "삭제관리자1", role: "ADMIN" });
    const story = await createStory(owner.id);
    const chapter = await createChapter(story.id, { title: "관리자 삭제 대상" });

    mockAuth.mockResolvedValue({ user: { id: admin.id, role: "ADMIN" } });

    const req = makeRequest(
      "DELETE",
      `http://localhost/api/stories/${story.id}/chapters/${chapter.id}`
    );
    const res = await deleteChapter(req, makeChapterContext(story.id, chapter.id));

    expect(res.status).toBe(200);

    const deleted = await prisma.chapter.findUnique({ where: { id: chapter.id } });
    expect(deleted).toBeNull();
  });
});
