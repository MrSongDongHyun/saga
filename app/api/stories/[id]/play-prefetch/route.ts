// POST /api/stories/[id]/play-prefetch
// 선택지 3개에 대한 AI 응답을 백그라운드에서 병렬 생성
// 즉시 prefetchId 반환 → play-stream에서 캐시 조회
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { askClaude } from "@/lib/ai/claude";
import { withDynamicHandler } from "@/lib/api-handler";
import { setPrefetchEntry } from "@/lib/play-prefetch-cache";

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
};

export const POST = withDynamicHandler(async (req, context) => {
  const { id } = await context.params;
  await requireAuth();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "Bad Request" }, { status: 400 });
  }

  const {
    choices,
    chapterTitle,
    chapterContent,
    playerSetup,
    currentStatus,
    turnCount,
    model,
  } = body as Record<string, unknown>;

  if (!Array.isArray(choices) || choices.length === 0) {
    return NextResponse.json({ error: "choices required" }, { status: 400 });
  }

  const story = await prisma.story.findUnique({
    where: { id },
    select: { id: true, title: true, genre: true, description: true },
  });

  if (!story) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
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

  const systemPrompt = `당신은 무협 인터랙티브 소설 게임 마스터입니다.
스토리: ${story.title}
장르: ${Array.isArray(story.genre) ? (story.genre as string[]).join(", ") : story.genre}
설명: ${story.description || ""}

${playerBlock}
${statusBlock}

현재 챕터: ${typeof chapterTitle === "string" ? chapterTitle : ""}
챕터 내용: ${typeof chapterContent === "string" ? chapterContent : ""}
진행 턴: ${turn}

★ 출력 형식 규칙 (절대 준수) ★
아래 세 섹션을 반드시 이 순서대로, 반드시 닫는 태그까지 포함해서 출력하세요.
마크다운 헤더(#), 수평선(---), 번호 목록을 사용하지 마세요.
태그는 대괄호 그대로 사용하며 절대 변형하지 마세요.

[STORY]
2~4단락의 서사 묘사. 플레이어의 행동 결과와 이후 상황을 생동감 있게 서술.
장르에 맞는 문체(무협이면 내공·초식·강호·의기 등 용어 활용).
[/STORY]

[STATUS_UPDATE]
변경된 STATUS 항목만 아래 형식으로 작성. 변경 없으면 이 섹션도 열고 닫되 내용 없이 출력.
숫자 증감: +5 또는 -3 형식. 절대값 설정: 숫자 그대로.
사용 가능 키: 이름, 성별, 나이, 별호, 경지, 내공, 명성, 세력, 직책, 권법, 심법, 경공,
소지품추가, 소지품제거, 의연추가, 입무, 위치, 특징추가
[/STATUS_UPDATE]

[CHOICES]
플레이어가 선택할 수 있는 행동 3가지. 각 줄에 하나씩. 번호나 기호 없이 텍스트만.
구체적이고 흥미로운 선택지로 작성.
[/CHOICES]

경지 단계 (참고): 범인 → 무공입문 → 후천일류 → 후천절정 → 선천경계 → 선천일류 → 선천절정 → 화경 → 신화`;

  const resolvedModel = typeof model === "string" ? model : undefined;

  // 선택지별 Promise 생성 (병렬 실행)
  const promises = new Map<string, Promise<string>>();
  for (const choice of choices as string[]) {
    if (typeof choice === "string" && choice.trim()) {
      promises.set(
        choice.trim(),
        askClaude(systemPrompt, choice.trim(), resolvedModel)
      );
    }
  }

  const prefetchId = randomUUID();
  setPrefetchEntry(prefetchId, promises);

  return NextResponse.json({ prefetchId });
});
