// app/api/stories/[id]/play-stream/route.ts 통합 테스트
// POST /api/stories/[id]/play-stream — SSE 스트리밍 플레이 응답
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { getTestPrisma } from "../setup";

// ── auth() 모킹 ────────────────────────────────────────────────
vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

// ── streamClaude 모킹 ─────────────────────────────────────────
// 실제 Claude CLI를 호출하지 않도록 목(mock)으로 대체
vi.mock("@/lib/ai/claude", () => ({
  streamClaude: vi.fn(),
}));

// ── prefetch 캐시 모킹 ────────────────────────────────────────
vi.mock("@/lib/play-prefetch-cache", () => ({
  getPrefetchPromise: vi.fn().mockReturnValue(null),
  deletePrefetchEntry: vi.fn(),
}));

import { auth } from "@/lib/auth";
const mockAuth = auth as ReturnType<typeof vi.fn>;

import { streamClaude } from "@/lib/ai/claude";
const mockStreamClaude = streamClaude as ReturnType<typeof vi.fn>;

import { POST } from "@/app/api/stories/[id]/play-stream/route";

// ─────────────────────────────────────────────
// 기본 CurrentStatus 픽스처
// ─────────────────────────────────────────────

const DEFAULT_CURRENT_STATUS = {
  name: "홍길동",
  gender: "남성",
  age: 25,
  nickname: "무명",
  level: "초입",
  internalPower: 50,
  fame: 0,
  faction: "화산파",
  position: "제자",
  skills: { fist: "기초권법", mind: "기초심법", lightness: "기초경공" },
  inventory: [],
  relationships: [],
  stage: "입문",
  location: "화산파 본산",
  traits: [],
  customStats: {} as Record<string, number>,
};

// ─────────────────────────────────────────────
// 헬퍼: streamClaude 동작 시뮬레이션
// ─────────────────────────────────────────────

/**
 * streamClaude가 onChunk와 onDone을 호출하는 시뮬레이션 설정
 * @param fullText AI가 반환할 전체 응답 텍스트
 */
function setupStreamClaudeMock(fullText: string) {
  mockStreamClaude.mockImplementation(
    async ({ onChunk, onDone }: {
      onChunk: (text: string) => void;
      onDone: (text: string) => void;
      onError: (err: Error) => void;
    }) => {
      // 전체 텍스트를 청크로 전달
      onChunk(fullText);
      onDone(fullText);
    }
  );
}

/**
 * SSE 스트림 Response의 모든 이벤트 파싱
 */
async function parseSSEResponse(res: Response): Promise<Array<Record<string, unknown>>> {
  if (!res.body) return [];
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const events: Array<Record<string, unknown>> = [];
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const evt = JSON.parse(line.slice(6)) as Record<string, unknown>;
        events.push(evt);
      } catch { /* 무시 */ }
    }
  }
  return events;
}

// ─────────────────────────────────────────────
// 요청 생성 헬퍼
// ─────────────────────────────────────────────

function makeRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeContext(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ─────────────────────────────────────────────
// DB 픽스처 헬퍼
// ─────────────────────────────────────────────

async function createUser(overrides: Partial<{ loginId: string; nickname: string }> = {}) {
  const prisma = getTestPrisma();
  return prisma.user.create({
    data: {
      loginId:  overrides.loginId  ?? `user_${Date.now()}_${Math.random()}`,
      password: "hashed_password",
      nickname: overrides.nickname ?? `nick_${Date.now()}_${Math.random()}`,
      role:     "USER",
    },
  });
}

async function createStory(
  authorId: string,
  overrides: Partial<{
    title: string;
    storyInfo: string;
    exampleDialogs: string;
    startContext: string;
    description: string;
  }> = {}
) {
  const prisma = getTestPrisma();
  return prisma.story.create({
    data: {
      title:          overrides.title          ?? `스토리_${Date.now()}`,
      genre:          '["판타지"]',
      tags:           "[]",
      status:         "ONGOING",
      visibility:     "PUBLIC",
      authorId,
      storyInfo:      overrides.storyInfo      ?? null,
      exampleDialogs: overrides.exampleDialogs ?? "[]",
      startContext:   overrides.startContext   ?? null,
      description:    overrides.description    ?? null,
    },
  });
}

async function createStatDef(storyId: string, name: string) {
  const prisma = getTestPrisma();
  return prisma.storyStatDef.create({
    data: {
      storyId,
      name,
      icon: "heart",
      color: "red",
      minVal: 0,
      maxVal: 100,
      defaultVal: 50,
      description: `${name} 스탯`,
    },
  });
}

async function createEnding(
  storyId: string,
  overrides: Partial<{ name: string; startTurn: number; minTurn: number }> = {}
) {
  const prisma = getTestPrisma();
  return prisma.storyEnding.create({
    data: {
      storyId,
      name:      overrides.name      ?? "테스트 엔딩",
      grade:     "SR",
      prompt:    "",
      minTurn:   overrides.minTurn   ?? 5,
      startTurn: overrides.startTurn ?? 5,
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
// 기본 인증/입력 검증
// ─────────────────────────────────────────────
describe("POST /api/stories/[id]/play-stream — 기본 검증", () => {
  it("미인증 → 401", async () => {
    mockAuth.mockResolvedValue(null);
    const owner = await createUser({ loginId: "ps1", nickname: "스트림1" });
    const story = await createStory(owner.id);

    const req = makeRequest(`http://localhost/api/stories/${story.id}/play-stream`, {
      userMessage: "테스트 메시지",
    });
    const res = await POST(req, makeContext(story.id));

    expect(res.status).toBe(401);
  });

  it("userMessage 누락 → 400", async () => {
    const owner = await createUser({ loginId: "ps2", nickname: "스트림2" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest(`http://localhost/api/stories/${story.id}/play-stream`, {
      chapterTitle: "1화",
    });
    const res = await POST(req, makeContext(story.id));

    expect(res.status).toBe(400);
  });

  it("빈 userMessage → 400", async () => {
    const owner = await createUser({ loginId: "ps3", nickname: "스트림3" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest(`http://localhost/api/stories/${story.id}/play-stream`, {
      userMessage: "   ", // 공백만
    });
    const res = await POST(req, makeContext(story.id));

    expect(res.status).toBe(400);
  });

  it("존재하지 않는 storyId → 404", async () => {
    const owner = await createUser({ loginId: "ps4", nickname: "스트림4" });
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = makeRequest("http://localhost/api/stories/nonexistent/play-stream", {
      userMessage: "테스트",
    });
    const res = await POST(req, makeContext("nonexistent"));

    expect(res.status).toBe(404);
  });

  it("잘못된 JSON body → 400", async () => {
    const owner = await createUser({ loginId: "ps5", nickname: "스트림5" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const req = new NextRequest(`http://localhost/api/stories/${story.id}/play-stream`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{{invalid}}",
    });
    const res = await POST(req, makeContext(story.id));

    expect(res.status).toBe(400);
  });
});

// ─────────────────────────────────────────────
// 정상 스트리밍 플로우
// ─────────────────────────────────────────────
describe("POST /api/stories/[id]/play-stream — 정상 스트리밍", () => {
  it("정상 요청 → 200, text/event-stream 헤더", async () => {
    const owner = await createUser({ loginId: "ps6", nickname: "스트림6" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const fullText = "[STORY]\n모험이 시작되었다.\n[/STORY]\n[STATUS_UPDATE]\n[/STATUS_UPDATE]\n[CHOICES]\n앞으로 나아간다\n주변을 살핀다\n돌아간다\n[/CHOICES]";
    setupStreamClaudeMock(fullText);

    const req = makeRequest(`http://localhost/api/stories/${story.id}/play-stream`, {
      userMessage: "이야기를 시작합니다.",
    });
    const res = await POST(req, makeContext(story.id));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
  });

  it("스트리밍 done 이벤트에 storyContent, choices 포함", async () => {
    const owner = await createUser({ loginId: "ps7", nickname: "스트림7" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const fullText = "[STORY]\n영웅이 나타났다.\n[/STORY]\n[STATUS_UPDATE]\n[/STATUS_UPDATE]\n[CHOICES]\n공격한다\n도망간다\n협상한다\n[/CHOICES]";
    setupStreamClaudeMock(fullText);

    const req = makeRequest(`http://localhost/api/stories/${story.id}/play-stream`, {
      userMessage: "행동을 선택합니다.",
    });
    const res = await POST(req, makeContext(story.id));
    const events = await parseSSEResponse(res);

    const doneEvent = events.find((e) => e.type === "done");
    expect(doneEvent).toBeDefined();
    expect(doneEvent?.storyContent).toContain("영웅이 나타났다");
    expect(Array.isArray(doneEvent?.choices)).toBe(true);
    expect((doneEvent?.choices as string[]).length).toBeGreaterThan(0);
  });

  it("chunk 이벤트들이 [STORY] 섹션 내용으로 구성됨", async () => {
    const owner = await createUser({ loginId: "ps8", nickname: "스트림8" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const storyContent = "검이 빛났다.";
    const fullText = `[STORY]\n${storyContent}\n[/STORY]\n[STATUS_UPDATE]\n[/STATUS_UPDATE]\n[CHOICES]\n공격\n방어\n후퇴\n[/CHOICES]`;
    setupStreamClaudeMock(fullText);

    const req = makeRequest(`http://localhost/api/stories/${story.id}/play-stream`, {
      userMessage: "검을 뽑는다.",
    });
    const res = await POST(req, makeContext(story.id));
    const events = await parseSSEResponse(res);

    const chunkEvents = events.filter((e) => e.type === "chunk");
    expect(chunkEvents.length).toBeGreaterThan(0);

    const combined = chunkEvents.map((e) => e.text).join("");
    expect(combined).toContain(storyContent);
  });
});

// ─────────────────────────────────────────────
// 시스템 프롬프트 검증
// ─────────────────────────────────────────────
describe("POST /api/stories/[id]/play-stream — 시스템 프롬프트 구성", () => {
  it("storyInfo가 시스템 프롬프트에 포함됨", async () => {
    const owner = await createUser({ loginId: "ps9", nickname: "스트림9" });
    const story = await createStory(owner.id, {
      storyInfo: "이 세계는 마법이 존재하는 판타지 세계다.",
    });
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    let capturedSystemPrompt = "";
    mockStreamClaude.mockImplementation(
      async ({ systemPrompt, onDone }: {
        systemPrompt: string;
        onChunk: (t: string) => void;
        onDone: (t: string) => void;
        onError: (e: Error) => void;
      }) => {
        capturedSystemPrompt = systemPrompt;
        onDone("[STORY]\n내용\n[/STORY]\n[STATUS_UPDATE]\n[/STATUS_UPDATE]\n[CHOICES]\n선택1\n[/CHOICES]");
      }
    );

    const req = makeRequest(`http://localhost/api/stories/${story.id}/play-stream`, {
      userMessage: "시작",
    });
    await POST(req, makeContext(story.id));

    expect(capturedSystemPrompt).toContain("이 세계는 마법이 존재하는 판타지 세계다.");
  });

  it("startContext가 첫 턴(turnCount<=1)에 시스템 프롬프트에 포함됨", async () => {
    const owner = await createUser({ loginId: "ps10", nickname: "스트림10" });
    const story = await createStory(owner.id, {
      startContext: "플레이어는 어두운 동굴에서 눈을 뜬다.",
    });
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    let capturedSystemPrompt = "";
    mockStreamClaude.mockImplementation(
      async ({ systemPrompt, onDone }: {
        systemPrompt: string;
        onChunk: (t: string) => void;
        onDone: (t: string) => void;
        onError: (e: Error) => void;
      }) => {
        capturedSystemPrompt = systemPrompt;
        onDone("[STORY]\n내용\n[/STORY]\n[STATUS_UPDATE]\n[/STATUS_UPDATE]\n[CHOICES]\n선택1\n[/CHOICES]");
      }
    );

    const req = makeRequest(`http://localhost/api/stories/${story.id}/play-stream`, {
      userMessage: "시작",
      turnCount: 0, // 첫 번째 턴
    });
    await POST(req, makeContext(story.id));

    expect(capturedSystemPrompt).toContain("플레이어는 어두운 동굴에서 눈을 뜬다.");
  });

  it("startContext가 이후 턴(turnCount>1)에는 시스템 프롬프트에 포함되지 않음", async () => {
    const owner = await createUser({ loginId: "ps11", nickname: "스트림11" });
    const story = await createStory(owner.id, {
      startContext: "이 텍스트는 나타나면 안된다.",
    });
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    let capturedSystemPrompt = "";
    mockStreamClaude.mockImplementation(
      async ({ systemPrompt, onDone }: {
        systemPrompt: string;
        onChunk: (t: string) => void;
        onDone: (t: string) => void;
        onError: (e: Error) => void;
      }) => {
        capturedSystemPrompt = systemPrompt;
        onDone("[STORY]\n내용\n[/STORY]\n[STATUS_UPDATE]\n[/STATUS_UPDATE]\n[CHOICES]\n선택1\n[/CHOICES]");
      }
    );

    const req = makeRequest(`http://localhost/api/stories/${story.id}/play-stream`, {
      userMessage: "계속",
      turnCount: 5, // 이후 턴
    });
    await POST(req, makeContext(story.id));

    expect(capturedSystemPrompt).not.toContain("이 텍스트는 나타나면 안된다.");
  });

  it("exampleDialogs가 시스템 프롬프트에 포함됨", async () => {
    const owner = await createUser({ loginId: "ps12", nickname: "스트림12" });
    const story = await createStory(owner.id, {
      exampleDialogs: JSON.stringify([
        { user: "마을을 탐색한다.", ai: "마을 중앙에 분수가 있다." },
      ]),
    });
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    let capturedSystemPrompt = "";
    mockStreamClaude.mockImplementation(
      async ({ systemPrompt, onDone }: {
        systemPrompt: string;
        onChunk: (t: string) => void;
        onDone: (t: string) => void;
        onError: (e: Error) => void;
      }) => {
        capturedSystemPrompt = systemPrompt;
        onDone("[STORY]\n내용\n[/STORY]\n[STATUS_UPDATE]\n[/STATUS_UPDATE]\n[CHOICES]\n선택1\n[/CHOICES]");
      }
    );

    const req = makeRequest(`http://localhost/api/stories/${story.id}/play-stream`, {
      userMessage: "시작",
    });
    await POST(req, makeContext(story.id));

    expect(capturedSystemPrompt).toContain("마을을 탐색한다.");
    expect(capturedSystemPrompt).toContain("마을 중앙에 분수가 있다.");
  });

  it("커스텀 스탯이 있으면 스탯 시스템이 시스템 프롬프트에 동적으로 주입됨", async () => {
    const owner = await createUser({ loginId: "ps13", nickname: "스트림13" });
    const story = await createStory(owner.id);
    await createStatDef(story.id, "우호도");
    await createStatDef(story.id, "체력");
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    let capturedSystemPrompt = "";
    mockStreamClaude.mockImplementation(
      async ({ systemPrompt, onDone }: {
        systemPrompt: string;
        onChunk: (t: string) => void;
        onDone: (t: string) => void;
        onError: (e: Error) => void;
      }) => {
        capturedSystemPrompt = systemPrompt;
        onDone("[STORY]\n내용\n[/STORY]\n[STATUS_UPDATE]\n[/STATUS_UPDATE]\n[CUSTOM_STATS_UPDATE]\n[/CUSTOM_STATS_UPDATE]\n[CHOICES]\n선택1\n[/CHOICES]");
      }
    );

    const req = makeRequest(`http://localhost/api/stories/${story.id}/play-stream`, {
      userMessage: "행동",
    });
    await POST(req, makeContext(story.id));

    // 커스텀 스탯 시스템 프롬프트에 스탯명 포함 확인
    expect(capturedSystemPrompt).toContain("우호도");
    expect(capturedSystemPrompt).toContain("체력");
    // CUSTOM_STATS_UPDATE 섹션 요청 포함 확인
    expect(capturedSystemPrompt).toContain("CUSTOM_STATS_UPDATE");
  });

  it("커스텀 스탯 없으면 스탯 시스템 블록이 시스템 프롬프트에 없음", async () => {
    const owner = await createUser({ loginId: "ps14", nickname: "스트림14" });
    const story = await createStory(owner.id); // 스탯 없음
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    let capturedSystemPrompt = "";
    mockStreamClaude.mockImplementation(
      async ({ systemPrompt, onDone }: {
        systemPrompt: string;
        onChunk: (t: string) => void;
        onDone: (t: string) => void;
        onError: (e: Error) => void;
      }) => {
        capturedSystemPrompt = systemPrompt;
        onDone("[STORY]\n내용\n[/STORY]\n[STATUS_UPDATE]\n[/STATUS_UPDATE]\n[CHOICES]\n선택1\n[/CHOICES]");
      }
    );

    const req = makeRequest(`http://localhost/api/stories/${story.id}/play-stream`, {
      userMessage: "행동",
    });
    await POST(req, makeContext(story.id));

    expect(capturedSystemPrompt).not.toContain("[커스텀 스탯 시스템]");
    expect(capturedSystemPrompt).not.toContain("CUSTOM_STATS_UPDATE");
  });
});

// ─────────────────────────────────────────────
// 엔딩 조건 체크 검증
// ─────────────────────────────────────────────
describe("POST /api/stories/[id]/play-stream — 엔딩 조건 체크", () => {
  it("turnCount % 5 === 0 이고 turnCount > 0 이면 엔딩 체크 수행됨", async () => {
    const owner = await createUser({ loginId: "ps15", nickname: "스트림15" });
    const story = await createStory(owner.id);
    const statDef = await createStatDef(story.id, "우호도");
    const ending = await createEnding(story.id, { name: "행복 엔딩", startTurn: 5, minTurn: 5 });
    const prisma = getTestPrisma();
    // 조건: 우호도 >= 80
    await prisma.endingCondition.create({
      data: { endingId: ending.id, statDefId: statDef.id, operator: "gte", value: 80, groupId: 0 },
    });

    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const fullText = "[STORY]\n내용\n[/STORY]\n[STATUS_UPDATE]\n[/STATUS_UPDATE]\n[CUSTOM_STATS_UPDATE]\n우호도: 85\n[/CUSTOM_STATS_UPDATE]\n[CHOICES]\n선택1\n[/CHOICES]";
    setupStreamClaudeMock(fullText);

    const req = makeRequest(`http://localhost/api/stories/${story.id}/play-stream`, {
      userMessage: "좋은 행동을 한다.",
      turnCount: 5, // 5턴 (% 5 === 0, > 0)
      currentStatus: {
        ...DEFAULT_CURRENT_STATUS,
        customStats: { [statDef.id]: 85 }, // 조건 충족
      },
    });
    const res = await POST(req, makeContext(story.id));
    const events = await parseSSEResponse(res);

    const doneEvent = events.find((e) => e.type === "done");
    expect(doneEvent).toBeDefined();
    // 엔딩 ID가 포함되어 있어야 함
    expect(doneEvent?.endingId).toBe(ending.id);
  });

  it("turnCount % 5 !== 0 이면 엔딩 체크 수행되지 않음", async () => {
    const owner = await createUser({ loginId: "ps16", nickname: "스트림16" });
    const story = await createStory(owner.id);
    const statDef = await createStatDef(story.id, "우호도2");
    const ending = await createEnding(story.id, { name: "행복 엔딩2", startTurn: 1, minTurn: 1 });
    const prisma = getTestPrisma();
    await prisma.endingCondition.create({
      data: { endingId: ending.id, statDefId: statDef.id, operator: "gte", value: 10, groupId: 0 },
    });

    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });
    setupStreamClaudeMock("[STORY]\n내용\n[/STORY]\n[STATUS_UPDATE]\n[/STATUS_UPDATE]\n[CHOICES]\n선택1\n[/CHOICES]");

    const req = makeRequest(`http://localhost/api/stories/${story.id}/play-stream`, {
      userMessage: "행동",
      turnCount: 3, // 3 % 5 !== 0
      currentStatus: { ...DEFAULT_CURRENT_STATUS, customStats: { [statDef.id]: 90 } },
    });
    const res = await POST(req, makeContext(story.id));
    const events = await parseSSEResponse(res);

    const doneEvent = events.find((e) => e.type === "done");
    expect(doneEvent).toBeDefined();
    expect(doneEvent?.endingId).toBeUndefined();
  });

  it("turnCount = 0 이면 엔딩 체크 수행되지 않음 (첫 턴 제외)", async () => {
    const owner = await createUser({ loginId: "ps17", nickname: "스트림17" });
    const story = await createStory(owner.id);
    const statDef = await createStatDef(story.id, "체력3");
    const ending = await createEnding(story.id, { name: "첫턴엔딩", startTurn: 0, minTurn: 0 });
    const prisma = getTestPrisma();
    await prisma.endingCondition.create({
      data: { endingId: ending.id, statDefId: statDef.id, operator: "gte", value: 1, groupId: 0 },
    });

    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });
    setupStreamClaudeMock("[STORY]\n내용\n[/STORY]\n[STATUS_UPDATE]\n[/STATUS_UPDATE]\n[CHOICES]\n선택1\n[/CHOICES]");

    const req = makeRequest(`http://localhost/api/stories/${story.id}/play-stream`, {
      userMessage: "시작",
      turnCount: 0, // turn=0 → 체크 안함
      currentStatus: { ...DEFAULT_CURRENT_STATUS, customStats: { [statDef.id]: 100 } },
    });
    const res = await POST(req, makeContext(story.id));
    const events = await parseSSEResponse(res);

    const doneEvent = events.find((e) => e.type === "done");
    expect(doneEvent).toBeDefined();
    expect(doneEvent?.endingId).toBeUndefined();
  });

  it("엔딩 조건 미충족이면 endingId 없음", async () => {
    const owner = await createUser({ loginId: "ps18", nickname: "스트림18" });
    const story = await createStory(owner.id);
    const statDef = await createStatDef(story.id, "악명");
    const ending = await createEnding(story.id, { name: "악당 엔딩", startTurn: 5, minTurn: 5 });
    const prisma = getTestPrisma();
    // 조건: 악명 >= 90 (충족 안 됨)
    await prisma.endingCondition.create({
      data: { endingId: ending.id, statDefId: statDef.id, operator: "gte", value: 90, groupId: 0 },
    });

    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });
    setupStreamClaudeMock("[STORY]\n내용\n[/STORY]\n[STATUS_UPDATE]\n[/STATUS_UPDATE]\n[CHOICES]\n선택1\n[/CHOICES]");

    const req = makeRequest(`http://localhost/api/stories/${story.id}/play-stream`, {
      userMessage: "행동",
      turnCount: 5, // 5턴 체크
      currentStatus: { ...DEFAULT_CURRENT_STATUS, customStats: { [statDef.id]: 50 } }, // 90 미만
    });
    const res = await POST(req, makeContext(story.id));
    const events = await parseSSEResponse(res);

    const doneEvent = events.find((e) => e.type === "done");
    expect(doneEvent).toBeDefined();
    expect(doneEvent?.endingId).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// 커스텀 스탯 업데이트 파싱
// ─────────────────────────────────────────────
describe("POST /api/stories/[id]/play-stream — 커스텀 스탯 업데이트", () => {
  it("CUSTOM_STATS_UPDATE 파싱 → done 이벤트에 customStats 포함", async () => {
    const owner = await createUser({ loginId: "ps19", nickname: "스트림19" });
    const story = await createStory(owner.id);
    const statDef = await createStatDef(story.id, "우호도");
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    const fullText = `[STORY]\n내용\n[/STORY]\n[STATUS_UPDATE]\n[/STATUS_UPDATE]\n[CUSTOM_STATS_UPDATE]\n우호도: +10\n[/CUSTOM_STATS_UPDATE]\n[CHOICES]\n선택1\n[/CHOICES]`;
    setupStreamClaudeMock(fullText);

    const req = makeRequest(`http://localhost/api/stories/${story.id}/play-stream`, {
      userMessage: "친절하게 행동한다.",
      currentStatus: { ...DEFAULT_CURRENT_STATUS, customStats: { [statDef.id]: 50 } },
    });
    const res = await POST(req, makeContext(story.id));
    const events = await parseSSEResponse(res);

    const doneEvent = events.find((e) => e.type === "done");
    expect(doneEvent).toBeDefined();
    expect(doneEvent?.customStats).toBeDefined();
    const cs = doneEvent?.customStats as Record<string, number>;
    // 50 + 10 = 60
    expect(cs[statDef.id]).toBe(60);
  });

  it("스탯 범위 초과 시 최대값으로 클램핑", async () => {
    const owner = await createUser({ loginId: "ps20", nickname: "스트림20" });
    const story = await createStory(owner.id);
    const statDef = await createStatDef(story.id, "체력");
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    // maxVal=100, 현재 90에서 +30 → 120 → 클램핑 → 100
    const fullText = `[STORY]\n내용\n[/STORY]\n[STATUS_UPDATE]\n[/STATUS_UPDATE]\n[CUSTOM_STATS_UPDATE]\n체력: +30\n[/CUSTOM_STATS_UPDATE]\n[CHOICES]\n선택1\n[/CHOICES]`;
    setupStreamClaudeMock(fullText);

    const req = makeRequest(`http://localhost/api/stories/${story.id}/play-stream`, {
      userMessage: "회복한다.",
      currentStatus: { ...DEFAULT_CURRENT_STATUS, customStats: { [statDef.id]: 90 } }, // 90에서 +30
    });
    const res = await POST(req, makeContext(story.id));
    const events = await parseSSEResponse(res);

    const doneEvent = events.find((e) => e.type === "done");
    const cs = doneEvent?.customStats as Record<string, number>;
    expect(cs[statDef.id]).toBe(100); // 최대값으로 클램핑
  });
});

// ─────────────────────────────────────────────
// 엣지 케이스
// ─────────────────────────────────────────────
describe("POST /api/stories/[id]/play-stream — 엣지 케이스", () => {
  it("스탯/엔딩 없는 스토리도 정상 동작", async () => {
    const owner = await createUser({ loginId: "ps21", nickname: "스트림21" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    setupStreamClaudeMock("[STORY]\n기본 이야기\n[/STORY]\n[STATUS_UPDATE]\n[/STATUS_UPDATE]\n[CHOICES]\n앞으로\n뒤로\n멈추기\n[/CHOICES]");

    const req = makeRequest(`http://localhost/api/stories/${story.id}/play-stream`, {
      userMessage: "시작",
    });
    const res = await POST(req, makeContext(story.id));

    expect(res.status).toBe(200);
    const events = await parseSSEResponse(res);
    const doneEvent = events.find((e) => e.type === "done");
    expect(doneEvent).toBeDefined();
  });

  it("playerSetup 있으면 플레이어 정보가 시스템 프롬프트에 포함됨", async () => {
    const owner = await createUser({ loginId: "ps22", nickname: "스트림22" });
    const story = await createStory(owner.id);
    mockAuth.mockResolvedValue({ user: { id: owner.id, role: "USER" } });

    let capturedSystemPrompt = "";
    mockStreamClaude.mockImplementation(
      async ({ systemPrompt, onDone }: {
        systemPrompt: string;
        onChunk: (t: string) => void;
        onDone: (t: string) => void;
        onError: (e: Error) => void;
      }) => {
        capturedSystemPrompt = systemPrompt;
        onDone("[STORY]\n내용\n[/STORY]\n[STATUS_UPDATE]\n[/STATUS_UPDATE]\n[CHOICES]\n선택1\n[/CHOICES]");
      }
    );

    const req = makeRequest(`http://localhost/api/stories/${story.id}/play-stream`, {
      userMessage: "시작",
      playerSetup: {
        name: "홍길동",
        gender: "남성",
        factionType: "정파",
        faction: "화산파",
        background: "검술 전문",
      },
    });
    await POST(req, makeContext(story.id));

    expect(capturedSystemPrompt).toContain("홍길동");
    expect(capturedSystemPrompt).toContain("화산파");
  });
});
