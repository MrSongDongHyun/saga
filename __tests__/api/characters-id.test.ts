// app/api/characters/[id]/route.ts 통합 테스트
// GET    /api/characters/[id]  — 상세 조회
// PUT    /api/characters/[id]  — 수정 (소유자 또는 ADMIN)
// DELETE /api/characters/[id]  — 삭제 (소유자 또는 ADMIN)
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
import { GET, PUT, DELETE } from "@/app/api/characters/[id]/route";

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
    personality: string;
    backgroundStory: string;
    firstMessage: string;
    avatar: string;
  }>
) {
  return getTestPrisma().character.create({
    data: {
      name: overrides?.name ?? "테스트 캐릭터",
      tags: overrides?.tags ?? JSON.stringify([]),
      visibility: overrides?.visibility ?? "PUBLIC",
      description: overrides?.description,
      personality: overrides?.personality,
      backgroundStory: overrides?.backgroundStory,
      firstMessage: overrides?.firstMessage,
      avatar: overrides?.avatar,
      creatorId,
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
// GET /api/characters/[id]
// ─────────────────────────────────────────────
describe("GET /api/characters/[id]", () => {
  it("존재하는 PUBLIC 캐릭터 조회 → 200, id 포함", async () => {
    const creator = await createUser("getuser1", "조회유저1");
    const character = await createCharacter(creator.id, {
      name: "공개 캐릭터",
      visibility: "PUBLIC",
    });

    const req = makeRequest("GET", `http://localhost/api/characters/${character.id}`);
    const res = await GET(req, makeContext(character.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(character.id);
    expect(body.name).toBe("공개 캐릭터");
  });

  it("존재하지 않는 ID 조회 → 404", async () => {
    const req = makeRequest("GET", "http://localhost/api/characters/nonexistent-id-xyz");
    const res = await GET(req, makeContext("nonexistent-id-xyz"));

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("PRIVATE 캐릭터를 소유자가 조회 → 200", async () => {
    const owner = await createUser("getuser2", "소유자유저1");
    const character = await createCharacter(owner.id, {
      name: "비공개 캐릭터",
      visibility: "PRIVATE",
    });

    // 소유자로 auth mock 설정
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("GET", `http://localhost/api/characters/${character.id}`);
    const res = await GET(req, makeContext(character.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(character.id);
  });

  it("PRIVATE 캐릭터를 비소유자가 조회 → 404 (존재 노출 방지)", async () => {
    const owner = await createUser("getuser3", "소유자유저2");
    const other = await createUser("getuser4", "타인유저1");
    const character = await createCharacter(owner.id, {
      name: "비공개 캐릭터2",
      visibility: "PRIVATE",
    });

    // 타인으로 auth mock 설정
    mockAuth.mockResolvedValue({ user: { id: other.id, role: "USER" } });

    const req = makeRequest("GET", `http://localhost/api/characters/${character.id}`);
    const res = await GET(req, makeContext(character.id));

    expect(res.status).toBe(404);
  });

  it("PRIVATE 캐릭터를 ADMIN이 조회 → 200", async () => {
    const owner = await createUser("getuser5", "소유자유저3");
    const admin = await createUser("adminuser1", "관리자유저1", "ADMIN");
    const character = await createCharacter(owner.id, {
      name: "ADMIN 조회 테스트 캐릭터",
      visibility: "PRIVATE",
    });

    // ADMIN으로 auth mock 설정
    mockAuth.mockResolvedValue({ user: { id: admin.id, role: "ADMIN" } });

    const req = makeRequest("GET", `http://localhost/api/characters/${character.id}`);
    const res = await GET(req, makeContext(character.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(character.id);
  });

  it("미인증 사용자가 PUBLIC 캐릭터 조회 → 200", async () => {
    const creator = await createUser("getuser6", "제작자유저1");
    const character = await createCharacter(creator.id, {
      name: "미인증 조회 캐릭터",
      visibility: "PUBLIC",
    });

    // auth()가 null 반환 (미인증)
    mockAuth.mockResolvedValue(null);

    const req = makeRequest("GET", `http://localhost/api/characters/${character.id}`);
    const res = await GET(req, makeContext(character.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(character.id);
  });

  it("응답에 creator 정보 포함", async () => {
    const creator = await createUser("getuser7", "제작자유저2");
    const character = await createCharacter(creator.id, {
      name: "제작자확인 캐릭터",
      visibility: "PUBLIC",
    });

    const req = makeRequest("GET", `http://localhost/api/characters/${character.id}`);
    const res = await GET(req, makeContext(character.id));

    const body = await res.json();
    expect(body).toHaveProperty("creator");
    expect(body.creator.id).toBe(creator.id);
    expect(body.creator.nickname).toBe("제작자유저2");
  });

  it("응답에 backgroundStory, firstMessage 포함 (상세 형식)", async () => {
    const creator = await createUser("getuser8", "상세유저1");
    const character = await createCharacter(creator.id, {
      name: "상세 캐릭터",
      visibility: "PUBLIC",
      backgroundStory: "배경 이야기",
      firstMessage: "첫 인사말",
    });

    const req = makeRequest("GET", `http://localhost/api/characters/${character.id}`);
    const res = await GET(req, makeContext(character.id));

    const body = await res.json();
    expect(body).toHaveProperty("backgroundStory");
    expect(body).toHaveProperty("firstMessage");
    expect(body.backgroundStory).toBe("배경 이야기");
    expect(body.firstMessage).toBe("첫 인사말");
  });
});

// ─────────────────────────────────────────────
// PUT /api/characters/[id]
// ─────────────────────────────────────────────
describe("PUT /api/characters/[id]", () => {
  it("미인증 → 401", async () => {
    // auth()가 null 반환 → requireAuth()가 401 throw
    mockAuth.mockResolvedValue(null);

    const creator = await createUser("putuser1", "수정유저1");
    const character = await createCharacter(creator.id, { name: "수정 대상 캐릭터1" });

    const req = makeRequest(
      "PUT",
      `http://localhost/api/characters/${character.id}`,
      { name: "수정된 이름" }
    );
    const res = await PUT(req, makeContext(character.id));

    expect(res.status).toBe(401);
  });

  it("소유자 수정 성공 → 200, 변경된 name 확인", async () => {
    const owner = await createUser("putuser2", "수정유저2");
    const character = await createCharacter(owner.id, { name: "원래 이름" });

    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest(
      "PUT",
      `http://localhost/api/characters/${character.id}`,
      { name: "변경된 이름" }
    );
    const res = await PUT(req, makeContext(character.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("변경된 이름");
    expect(body.id).toBe(character.id);
  });

  it("비소유자 수정 시도 → 403", async () => {
    const owner = await createUser("putuser3", "수정유저3");
    const other = await createUser("putuser4", "타인유저2");
    const character = await createCharacter(owner.id, { name: "수정 불가 캐릭터" });

    // 타인으로 auth mock 설정
    mockAuth.mockResolvedValue({ user: { id: other.id, role: "USER" } });

    const req = makeRequest(
      "PUT",
      `http://localhost/api/characters/${character.id}`,
      { name: "무단 수정 시도" }
    );
    const res = await PUT(req, makeContext(character.id));

    expect(res.status).toBe(403);
  });

  it("존재하지 않는 ID 수정 → 404", async () => {
    const user = await createUser("putuser5", "수정유저5");
    mockAuth.mockResolvedValue({ user: { id: user.id, role: "USER" } });

    const req = makeRequest(
      "PUT",
      "http://localhost/api/characters/nonexistent-id-put",
      { name: "수정된 이름" }
    );
    const res = await PUT(req, makeContext("nonexistent-id-put"));

    expect(res.status).toBe(404);
  });

  it("빈 body 전달 → 200 (변경 없이 성공)", async () => {
    const owner = await createUser("putuser6", "수정유저6");
    const character = await createCharacter(owner.id, { name: "변경 없는 캐릭터" });

    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest(
      "PUT",
      `http://localhost/api/characters/${character.id}`,
      {}
    );
    const res = await PUT(req, makeContext(character.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    // 이름이 그대로 유지됨
    expect(body.name).toBe("변경 없는 캐릭터");
  });

  it("유효성 오류 (name 빈 문자열) → 400", async () => {
    const owner = await createUser("putuser7", "수정유저7");
    const character = await createCharacter(owner.id, { name: "유효성 오류 테스트" });

    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest(
      "PUT",
      `http://localhost/api/characters/${character.id}`,
      { name: "" }
    );
    const res = await PUT(req, makeContext(character.id));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("nullable 필드(description) null로 수정 → 200, null 반영 확인", async () => {
    const owner = await createUser("putuser8", "수정유저8");
    const character = await createCharacter(owner.id, {
      name: "null 수정 캐릭터",
      description: "기존 소개",
    });

    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest(
      "PUT",
      `http://localhost/api/characters/${character.id}`,
      { description: null }
    );
    const res = await PUT(req, makeContext(character.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.description).toBeNull();
  });

  it("ADMIN이 타인 캐릭터 수정 → 200", async () => {
    const owner = await createUser("putuser9", "수정유저9");
    const admin = await createUser("putadmin1", "관리자유저2", "ADMIN");
    const character = await createCharacter(owner.id, { name: "관리자 수정 대상" });

    mockAuth.mockResolvedValue({ user: { id: admin.id, role: "ADMIN" } });

    const req = makeRequest(
      "PUT",
      `http://localhost/api/characters/${character.id}`,
      { name: "관리자 수정 완료" }
    );
    const res = await PUT(req, makeContext(character.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("관리자 수정 완료");
  });
});

// ─────────────────────────────────────────────
// DELETE /api/characters/[id]
// ─────────────────────────────────────────────
describe("DELETE /api/characters/[id]", () => {
  it("미인증 → 401", async () => {
    mockAuth.mockResolvedValue(null);

    const creator = await createUser("deluser1", "삭제유저1");
    const character = await createCharacter(creator.id, { name: "삭제 대상 캐릭터1" });

    const req = makeRequest("DELETE", `http://localhost/api/characters/${character.id}`);
    const res = await DELETE(req, makeContext(character.id));

    expect(res.status).toBe(401);
  });

  it("소유자 삭제 → 200, DB에서 실제 삭제 확인", async () => {
    const prisma = getTestPrisma();
    const owner = await createUser("deluser2", "삭제유저2");
    const character = await createCharacter(owner.id, { name: "실제 삭제 캐릭터" });

    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("DELETE", `http://localhost/api/characters/${character.id}`);
    const res = await DELETE(req, makeContext(character.id));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("message");

    // DB에서 실제 삭제 확인
    const deleted = await prisma.character.findUnique({ where: { id: character.id } });
    expect(deleted).toBeNull();
  });

  it("비소유자 삭제 시도 → 403", async () => {
    const owner = await createUser("deluser3", "삭제유저3");
    const other = await createUser("deluser4", "타인유저3");
    const character = await createCharacter(owner.id, { name: "삭제 불가 캐릭터" });

    // 타인으로 auth mock 설정
    mockAuth.mockResolvedValue({ user: { id: other.id, role: "USER" } });

    const req = makeRequest("DELETE", `http://localhost/api/characters/${character.id}`);
    const res = await DELETE(req, makeContext(character.id));

    expect(res.status).toBe(403);

    // DB에서 캐릭터가 삭제되지 않았는지 확인
    const prisma = getTestPrisma();
    const stillExists = await prisma.character.findUnique({ where: { id: character.id } });
    expect(stillExists).not.toBeNull();
  });

  it("존재하지 않는 ID 삭제 → 404", async () => {
    const user = await createUser("deluser5", "삭제유저5");
    mockAuth.mockResolvedValue({ user: { id: user.id, role: "USER" } });

    const req = makeRequest("DELETE", "http://localhost/api/characters/nonexistent-id-del");
    const res = await DELETE(req, makeContext("nonexistent-id-del"));

    expect(res.status).toBe(404);
  });

  it("ADMIN이 타인 캐릭터 삭제 → 200, DB에서 삭제 확인", async () => {
    const prisma = getTestPrisma();
    const owner = await createUser("deluser6", "삭제유저6");
    const admin = await createUser("deladmin1", "관리자유저3", "ADMIN");
    const character = await createCharacter(owner.id, { name: "관리자 삭제 대상" });

    mockAuth.mockResolvedValue({ user: { id: admin.id, role: "ADMIN" } });

    const req = makeRequest("DELETE", `http://localhost/api/characters/${character.id}`);
    const res = await DELETE(req, makeContext(character.id));

    expect(res.status).toBe(200);

    // DB에서 실제 삭제 확인
    const deleted = await prisma.character.findUnique({ where: { id: character.id } });
    expect(deleted).toBeNull();
  });
});
