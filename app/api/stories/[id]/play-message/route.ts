// 스토리 플레이 전용 메시지 API
// POST /api/stories/[id]/play-message
// 캐릭터 세션 없이 챕터 컨텍스트 기반으로 Claude에게 직접 요청
// crack.wrtn.ai 참고: 구조화된 응답 (STORY + STATUS_UPDATE + CHOICES)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { askClaude } from "@/lib/ai/claude";
import { withDynamicHandler } from "@/lib/api-handler";

// ─────────────────────────────────────────────
// 요청 바디 타입
// ─────────────────────────────────────────────

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

// ─────────────────────────────────────────────
// 핸들러
// ─────────────────────────────────────────────

export const POST = withDynamicHandler(async (req, context) => {
  const { id } = await context.params;

  // 인증 필수 (Claude CLI 비용 보호)
  await requireAuth();

  // 요청 바디 파싱
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "요청 본문을 파싱할 수 없습니다." },
      { status: 400 }
    );
  }

  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const {
    userMessage,
    chapterTitle,
    chapterContent,
    playerSetup,
    currentStatus,
    turnCount,
  } = body as Record<string, unknown>;

  if (typeof userMessage !== "string" || !userMessage.trim()) {
    return NextResponse.json(
      { error: "userMessage는 필수입니다.", field: "userMessage" },
      { status: 400 }
    );
  }

  // 스토리 존재 확인
  const story = await prisma.story.findUnique({
    where: { id },
    select: { id: true, title: true, genre: true, description: true },
  });

  if (!story) {
    return NextResponse.json(
      { error: "스토리를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // ─────────────────────────────────────────────
  // 플레이어 설정 블록
  // ─────────────────────────────────────────────

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

  // ─────────────────────────────────────────────
  // 시스템 프롬프트 구성
  // ─────────────────────────────────────────────

  const systemPrompt = `당신은 무협 인터랙티브 소설 게임 마스터입니다.
스토리: ${story.title}
장르: ${Array.isArray(story.genre) ? (story.genre as string[]).join(", ") : story.genre}
설명: ${story.description || ""}

${playerBlock}
${statusBlock}

현재 챕터: ${typeof chapterTitle === "string" ? chapterTitle : ""}
챕터 내용: ${typeof chapterContent === "string" ? chapterContent : ""}
진행 턴: ${turn}

[응답 형식 규칙]
반드시 아래 세 섹션을 순서대로 출력하세요.

[STORY]
2~4단락의 서사 묘사. 플레이어의 행동 결과와 이후 상황을 생동감 있게 서술.
무협 세계관 특유의 문체(내공, 초식, 강호, 의기 등 용어 활용).
[/STORY]

[STATUS_UPDATE]
변경된 STATUS 항목만 아래 형식으로 작성. 변경 없으면 이 섹션 생략 가능.
숫자 증감: +5 또는 -3 형식. 절대값 설정: 숫자 그대로.
사용 가능 키: 이름, 성별, 나이, 별호, 경지, 내공, 명성, 세력, 직책, 권법, 심법, 경공,
소지품추가, 소지품제거, 의연추가, 입무, 위치, 특징추가
예시:
내공: +10
위치: 화산파 뒷산
소지품추가: 화산검보
[/STATUS_UPDATE]

[CHOICES]
플레이어가 선택할 수 있는 행동 3가지. 각 줄에 하나씩.
구체적이고 흥미로운 선택지로 작성. 무협적 행동 중심.
[/CHOICES]

경지 단계 (참고): 범인 → 무공입문 → 후천일류 → 후천절정 → 선천경계 → 선천일류 → 선천절정 → 화경 → 신화`;

  // ─────────────────────────────────────────────
  // Claude 호출
  // ─────────────────────────────────────────────

  try {
    const rawReply = await askClaude(systemPrompt, userMessage);
    return NextResponse.json({ rawReply });
  } catch (err) {
    console.error("[play-message] Claude 호출 실패:", err);
    return NextResponse.json(
      { error: "AI 응답 생성에 실패했습니다." },
      { status: 500 }
    );
  }
});
