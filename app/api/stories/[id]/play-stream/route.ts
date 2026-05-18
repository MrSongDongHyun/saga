// POST /api/stories/[id]/play-stream
// SSE 스트리밍 스토리 플레이 응답 API
// chunk 이벤트: { type:"chunk", text:"..." }  ← [STORY] 섹션 내용만
// done  이벤트: { type:"done", storyContent, rawStatus, choices, endingId? }
// prefetchId 있으면 캐시에서 즉시 반환 (프리페치 히트)
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { streamClaude } from "@/lib/ai/claude";
import { withDynamicHandler } from "@/lib/api-handler";
import { getPrefetchPromise, deletePrefetchEntry } from "@/lib/play-prefetch-cache";

type PlayerSetup = {
  name: string;
  gender: string;
  factionType: string;
  faction: string;
  background: string;
};

type CurrentStatus = {
  name: string;
  gender: string;
  age: number;
  nickname: string;
  level: string;
  internalPower: number;
  fame: number;
  faction: string;
  position: string;
  skills: { fist: string; mind: string; lightness: string };
  inventory: string[];
  relationships: string[];
  stage: string;
  location: string;
  traits: string[];
  // 커스텀 스탯 값 (statDefId → value)
  customStats?: Record<string, number>;
};

type StatLevelDef = {
  name: string;
  minVal: number;
  maxVal: number;
  prompt: string;
};

type StatDef = {
  id: string;
  name: string;
  unit: string | null;
  description: string;
  minVal: number;
  maxVal: number;
  defaultVal: number;
  levels: StatLevelDef[];
};

type EndingCondition = {
  statDefId: string;
  operator: string;
  value: number;
  groupId: number;
};

type EndingDef = {
  id: string;
  grade: string;
  name: string;
  prompt: string;
  epilogue: string | null;
  minTurn: number;
  startTurn: number;
  conditions: EndingCondition[];
};

type MediaItemRef = {
  id: string;
  category: string;
  situation: string;
  imageUrl: string;
};

// ─────────────────────────────────────────────
// 서버사이드 AI 응답 파서
// ─────────────────────────────────────────────

function parseAIResponseServer(raw: string): {
  storyContent: string;
  rawStatus: string;
  choices: string[];
} {
  function extractSection(tag: string): string | null {
    const exactRe = new RegExp(`\\[${tag}\\]([\\s\\S]*?)\\[\\/${tag}\\]`);
    const exact = raw.match(exactRe);
    if (exact) return exact[1].trim();

    const headerRe = new RegExp(
      `(?:^|\\n)#+\\s*\\[${tag}\\][^\\n]*\\n([\\s\\S]*?)(?=\\n\\s*---\\s*(?:\\n|$)|\\n#+\\s*\\[|$)`
    );
    const header = raw.match(headerRe);
    if (header) return header[1].trim();
    return null;
  }

  const storySection = extractSection("STORY");
  const statusSection = extractSection("STATUS_UPDATE");
  const choicesSection = extractSection("CHOICES");

  const storyContent = storySection ?? raw.trim();
  const rawStatus = statusSection
    ? `[STATUS_UPDATE]\n${statusSection}\n[/STATUS_UPDATE]`
    : "";

  const choices: string[] = [];
  if (choicesSection) {
    choicesSection.split("\n").forEach((line) => {
      const clean = line.replace(/^[-*\d.]\s*/, "").trim();
      if (clean) choices.push(clean);
    });
  }

  return { storyContent, rawStatus, choices };
}

// ─────────────────────────────────────────────
// 커스텀 스탯 업데이트 파서
// AI 응답에서 [CUSTOM_STATS] 섹션 파싱
// ─────────────────────────────────────────────
function parseCustomStatsUpdate(
  raw: string,
  currentStats: Record<string, number>,
  statDefs: StatDef[]
): Record<string, number> {
  const sectionRe = /\[CUSTOM_STATS_UPDATE\]([\s\S]*?)\[\/CUSTOM_STATS_UPDATE\]/;
  const match = raw.match(sectionRe);
  if (!match) return currentStats;

  const updated = { ...currentStats };
  const lines = match[1].split("\n");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [namePart, valuePart] = trimmed.split(":").map((s) => s.trim());
    if (!namePart || valuePart === undefined) continue;

    const def = statDefs.find((d) => d.name === namePart);
    if (!def) continue;

    const current = currentStats[def.id] ?? def.defaultVal;
    let newVal: number;

    if (valuePart.startsWith("+")) {
      newVal = current + parseInt(valuePart.slice(1), 10);
    } else if (valuePart.startsWith("-")) {
      newVal = current - parseInt(valuePart.slice(1), 10);
    } else {
      newVal = parseInt(valuePart, 10);
    }

    if (!isNaN(newVal)) {
      updated[def.id] = Math.max(def.minVal, Math.min(def.maxVal, newVal));
    }
  }

  return updated;
}

// ─────────────────────────────────────────────
// SCENE_TAG 파싱 + 미디어 매칭
// AI 응답에서 [SCENE_TAG]분류/상황[/SCENE_TAG] 파싱 후 DB 매칭
// ─────────────────────────────────────────────
function matchMediaFromScene(
  raw: string,
  mediaItems: MediaItemRef[]
): string | null {
  if (mediaItems.length === 0) return null;

  const match = raw.match(/\[SCENE_TAG\]([\s\S]*?)\[\/SCENE_TAG\]/);
  if (!match) return null;

  const tag = match[1].trim();
  const parts = tag.split("/").map((s) => s.trim());
  if (parts.length < 2) return null;

  const [tagCategory, tagSituation] = parts;

  // 정확 매칭 (category + situation 모두)
  const exact = mediaItems.find(
    (m) => m.category === tagCategory && m.situation === tagSituation
  );
  if (exact) return exact.imageUrl;

  // 부분 매칭: situation만
  const partial = mediaItems.find((m) => m.situation === tagSituation);
  if (partial) return partial.imageUrl;

  // 부분 매칭: category만 (랜덤 중 첫 번째)
  const catMatch = mediaItems.find((m) => m.category === tagCategory);
  if (catMatch) return catMatch.imageUrl;

  return null;
}

// ─────────────────────────────────────────────
// 엔딩 조건 체크
// ─────────────────────────────────────────────
function checkEndingConditions(
  endings: EndingDef[],
  statValues: Record<string, number>,
  turnCount: number
): EndingDef | null {
  for (const ending of endings) {
    if (turnCount < ending.startTurn) continue;
    if (turnCount % 5 !== 0) continue; // 5턴마다 체크

    if (ending.conditions.length === 0) continue;

    // groupId=0 은 전체 AND 체인
    // groupId>0 은 같은 groupId끼리 OR, 다른 groupId끼리 AND
    const groups = new Map<number, EndingCondition[]>();
    for (const cond of ending.conditions) {
      const arr = groups.get(cond.groupId) ?? [];
      arr.push(cond);
      groups.set(cond.groupId, arr);
    }

    // 각 그룹 내에서 OR, 그룹 간 AND
    let allGroupsMet = true;
    for (const groupConds of Array.from(groups.values())) {
      const groupMet = groupConds.some((cond: EndingCondition) => {
        const val = statValues[cond.statDefId] ?? 0;
        switch (cond.operator) {
          case "gt":  return val > cond.value;
          case "gte": return val >= cond.value;
          case "lt":  return val < cond.value;
          case "lte": return val <= cond.value;
          case "eq":  return val === cond.value;
          case "ne":  return val !== cond.value;
          default:    return false;
        }
      });
      if (!groupMet) { allGroupsMet = false; break; }
    }

    if (allGroupsMet) return ending;
  }
  return null;
}

// ─────────────────────────────────────────────
// 핸들러
// ─────────────────────────────────────────────

export const POST = withDynamicHandler(async (req: NextRequest, context) => {
  const { id } = await context.params;
  await requireAuth();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return new Response("Bad Request", { status: 400 });
  }

  const {
    userMessage,
    chapterTitle,
    chapterContent,
    playerSetup,
    currentStatus,
    turnCount,
    model,
    prefetchId,
    prefetchedChoice,
  } = body as Record<string, unknown>;

  if (typeof userMessage !== "string" || !userMessage.trim()) {
    return new Response("userMessage required", { status: 400 });
  }

  // ─── 프리페치 캐시 히트 확인 ───────────────────────
  if (typeof prefetchId === "string" && typeof prefetchedChoice === "string") {
    const cached = getPrefetchPromise(prefetchId, prefetchedChoice);
    if (cached) {
      try {
        const fullText = await cached;
        deletePrefetchEntry(prefetchId);
        const parsed = parseAIResponseServer(fullText);

        const enc = new TextEncoder();
        const hitStream = new ReadableStream({
          start(ctrl) {
            const send = (d: object) =>
              ctrl.enqueue(enc.encode(`data: ${JSON.stringify(d)}\n\n`));
            const CHUNK = 20;
            for (let i = 0; i < parsed.storyContent.length; i += CHUNK) {
              send({ type: "chunk", text: parsed.storyContent.slice(i, i + CHUNK) });
            }
            send({ type: "done", ...parsed });
            ctrl.close();
          },
        });
        return new Response(hitStream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
          },
        });
      } catch {
        // 프리페치 실패 → 정상 스트리밍으로 폴백
      }
    }
  }
  // ────────────────────────────────────────────────────

  // 스토리 + 커스텀 스탯 + 엔딩 정보 조회
  const story = await prisma.story.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      genre: true,
      description: true,
      storyInfo: true,
      exampleDialogs: true,
      startContext: true,
      promptTemplate: true,
      maxOutput: true,
      statDefs: {
        include: { levels: { orderBy: { sortOrder: "asc" } } },
        orderBy: { sortOrder: "asc" },
      },
      endings: {
        include: { conditions: true },
        orderBy: { sortOrder: "asc" },
      },
      mediaItems: {
        select: { id: true, category: true, situation: true, imageUrl: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!story) {
    return new Response("Not Found", { status: 404 });
  }

  const setup = playerSetup as PlayerSetup | undefined;
  const status = currentStatus as CurrentStatus | undefined;
  const turn = typeof turnCount === "number" ? turnCount : 0;

  const playerBlock = setup
    ? `
[플레이어 설정]
이름: ${setup.name}
성별: ${setup.gender}
세력 유형: ${setup.factionType}
소속 세력: ${setup.faction}
출신 배경: ${setup.background || "없음"}
`
    : "";

  const statusBlock = status
    ? `
[현재 STATUS]
이름: ${status.name} / 성별: ${status.gender} / 나이: ${status.age}세
별호: ${status.nickname}
경지: ${status.level}
내공: ${status.internalPower} / 명성: ${status.fame}
세력: ${status.faction} / 직책: ${status.position}
권법: ${status.skills.fist} / 심법: ${status.skills.mind} / 경공: ${status.skills.lightness}
소지품: ${status.inventory.join(", ") || "없음"}
의연: ${status.relationships.join(", ") || "없음"}
입무: ${status.stage} / 위치: ${status.location}
특징: ${status.traits.join(", ") || "없음"}
`
    : "";

  // 커스텀 스탯 현재 값 구성
  const currentCustomStats: Record<string, number> = status?.customStats ?? {};
  const statDefs = story.statDefs as unknown as StatDef[];
  const endingDefs = story.endings as unknown as EndingDef[];
  const mediaItems = story.mediaItems as unknown as MediaItemRef[];

  // 커스텀 스탯 시스템 프롬프트 블록
  const customStatCurrentBlock = statDefs.length > 0
    ? `
[현재 커스텀 스탯]
${statDefs.map((s) => {
  const val = currentCustomStats[s.id] ?? s.defaultVal;
  const lvl = s.levels.find((l) => val >= l.minVal && val <= l.maxVal);
  return `${s.name}: ${val}${s.unit ?? ""} (${lvl?.name ?? ""})`;
}).join("\n")}
`
    : "";

  const customStatDefBlock = statDefs.length > 0
    ? `
[커스텀 스탯 시스템]
아래 스탯을 추적하고 대화 흐름에 따라 [CUSTOM_STATS_UPDATE] 섹션에 변경값을 출력하세요.
${statDefs.map((s) => {
  const levelStr = s.levels.map((l) => `${l.name}(${l.minVal}~${l.maxVal}): ${l.prompt}`).join(", ");
  return `- ${s.name}${s.unit ? `(${s.unit})` : ""}: ${s.description}${levelStr ? `\n  레벨: ${levelStr}` : ""}`;
}).join("\n")}
`
    : "";

  // 전개 예시 블록
  let parsedExamples: Array<{ user: string; ai: string }> = [];
  try {
    const raw = JSON.parse(story.exampleDialogs || "[]") as unknown;
    if (Array.isArray(raw)) parsedExamples = raw as Array<{ user: string; ai: string }>;
  } catch { /* ignore */ }

  const exampleBlock = parsedExamples.length > 0
    ? `
[대화 예시]
${parsedExamples.map((ex, i) => `예시 ${i + 1}:\n사용자: ${ex.user}\nAI: ${ex.ai}`).join("\n\n")}
`
    : "";

  // storyInfo 블록
  const storyInfoBlock = story.storyInfo
    ? `
[스토리 설정 정보]
${story.storyInfo}
`
    : "";

  // startContext 블록 (첫 턴)
  const startContextBlock = story.startContext && turn <= 1
    ? `
[시작 상황]
${story.startContext}
`
    : "";

  // 커스텀 스탯 출력 형식
  const customStatOutputFormat = statDefs.length > 0
    ? `
[CUSTOM_STATS_UPDATE]
변경된 커스텀 스탯만 아래 형식으로 작성. 변경 없으면 열고 닫되 내용 없이 출력.
숫자 증감: +5 또는 -3 형식. 절대값 설정: 숫자 그대로.
예시:
${statDefs[0]?.name ?? "스탯"}: +5
[/CUSTOM_STATS_UPDATE]
`
    : "";

  // SCENE_TAG 출력 형식 (미디어 등록된 경우에만 요청)
  const sceneTagFormat = mediaItems.length > 0
    ? `
[SCENE_TAG]분류/상황[/SCENE_TAG]
현재 장면에 가장 어울리는 분류와 상황을 슬래시(/)로 구분해 한 줄로 작성.
등록된 미디어 분류 목록: ${Array.from(new Set(mediaItems.map((m) => m.category))).join(", ")}
`
    : "";

  const genreStr = (() => {
    try {
      const parsed: unknown = JSON.parse(story.genre);
      if (Array.isArray(parsed)) return (parsed as string[]).join(", ");
    } catch { /* ignore */ }
    return story.genre;
  })();

  const systemPrompt = `당신은 인터랙티브 소설 게임 마스터입니다.
스토리: ${story.title}
장르: ${genreStr}
설명: ${story.description || ""}

${storyInfoBlock}
${playerBlock}
${statusBlock}
${customStatCurrentBlock}
${customStatDefBlock}
${exampleBlock}
${startContextBlock}

현재 챕터: ${typeof chapterTitle === "string" ? chapterTitle : ""}
챕터 내용: ${typeof chapterContent === "string" ? chapterContent : ""}
진행 턴: ${turn}

★ 출력 형식 규칙 (절대 준수) ★
아래 섹션들을 반드시 이 순서대로, 반드시 닫는 태그까지 포함해서 출력하세요.
마크다운 헤더(#), 수평선(---), 번호 목록을 사용하지 마세요.
태그는 대괄호 그대로 사용하며 절대 변형하지 마세요.

[STORY]
2~4단락의 서사 묘사. 플레이어의 행동 결과와 이후 상황을 생동감 있게 서술.
장르에 맞는 문체와 용어를 활용.
[/STORY]

[STATUS_UPDATE]
변경된 STATUS 항목만 아래 형식으로 작성. 변경 없으면 열고 닫되 내용 없이 출력.
숫자 증감: +5 또는 -3 형식. 절대값 설정: 숫자 그대로.
사용 가능 키: 이름, 성별, 나이, 별호, 경지, 내공, 명성, 세력, 직책, 권법, 심법, 경공,
소지품추가, 소지품제거, 의연추가, 입무, 위치, 특징추가
[/STATUS_UPDATE]
${customStatOutputFormat}
${sceneTagFormat}
[CHOICES]
플레이어가 선택할 수 있는 행동 3가지. 각 줄에 하나씩. 번호나 기호 없이 텍스트만.
구체적이고 흥미로운 선택지로 작성.
[/CHOICES]`;

  const resolvedModel = typeof model === "string" ? model : undefined;

  // SSE 스트림
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      let storyStarted = false;
      let storyEnded = false;
      let storyBuf = "";
      let fullText = "";

      await streamClaude({
        systemPrompt,
        messages: [{ role: "user", content: userMessage as string }],
        model: resolvedModel,
        onChunk: (chunk) => {
          fullText += chunk;
          if (storyEnded) return;
          storyBuf += chunk;

          if (!storyStarted) {
            const idx = storyBuf.indexOf("[STORY]");
            if (idx === -1) {
              if (storyBuf.length > 7) storyBuf = storyBuf.slice(-7);
              return;
            }
            storyStarted = true;
            storyBuf = storyBuf.slice(idx + 7);
          }

          const endIdx = storyBuf.indexOf("/STORY]");
          if (endIdx !== -1) {
            storyEnded = true;
            const toSend = storyBuf.slice(0, endIdx);
            if (toSend) send({ type: "chunk", text: toSend });
            storyBuf = "";
            return;
          }

          const safeLen = storyBuf.length - 8;
          if (safeLen > 0) {
            send({ type: "chunk", text: storyBuf.slice(0, safeLen) });
            storyBuf = storyBuf.slice(safeLen);
          }
        },
        onDone: (rawFull) => {
          if (storyStarted && !storyEnded && storyBuf.length > 0) {
            send({ type: "chunk", text: storyBuf });
          }

          const parsed = parseAIResponseServer(rawFull);

          // 커스텀 스탯 업데이트
          const updatedCustomStats = statDefs.length > 0
            ? parseCustomStatsUpdate(rawFull, currentCustomStats, statDefs)
            : currentCustomStats;

          // 엔딩 조건 체크 (5턴마다)
          let triggeredEndingId: string | undefined;
          if (endingDefs.length > 0 && turn % 5 === 0 && turn > 0) {
            const triggered = checkEndingConditions(endingDefs, updatedCustomStats, turn);
            if (triggered) {
              triggeredEndingId = triggered.id;
              if (triggered.epilogue) {
                parsed.storyContent = parsed.storyContent + "\n\n" + triggered.epilogue;
              }
            }
          }

          // SCENE_TAG 파싱 + 미디어 매칭
          const matchedMediaUrl = matchMediaFromScene(rawFull, mediaItems) ?? undefined;

          send({
            type: "done",
            ...parsed,
            customStats: updatedCustomStats,
            endingId: triggeredEndingId,
            mediaUrl: matchedMediaUrl,
          });
          controller.close();
        },
        onError: (err) => {
          send({ type: "error", message: err.message });
          controller.close();
        },
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});
