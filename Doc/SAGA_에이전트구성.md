# SAGA — 에이전트 구성 문서

> 3개 분석 문서(기술구조·시스템프롬프트·개발문서) + UI 클론 통합 기반  
> **모든 AI 에이전트의 프롬프트 조립·메모리·라우팅·실시간 흐름 구현 사양**

---

## 0. 에이전트 전체 구조

```
┌────────────────────────────────────────────────────────────┐
│                    SAGA 에이전트 맵                         │
│                                                            │
│  ① 캐릭터 채팅 에이전트  — 1:1 실시간 롤플레잉 대화       │
│  ② 스토리 생성 에이전트  — 챕터·씬 텍스트 생성             │
│  ③ 메모리 관리 에이전트  — 장기/단기/관계도/목표 관리       │
│  ④ 이미지 생성 에이전트  — 커버·상황 이미지 생성            │
│  ⑤ 프롬프트 조립 엔진   — L1~L6 컨텍스트 빌더 (공통)      │
└────────────────────────────────────────────────────────────┘
```

모든 에이전트는 **프롬프트 조립 엔진(⑤)** 을 공통으로 사용하며,  
Claude CLI(`child_process.spawn`)로 실행됩니다.

---

## 1. 프롬프트 조립 엔진 (공통 핵심)

### 1-1. L1~L6 레이어 구조

실제 구현(`lib/ai/promptBuilder.ts`)은 `CharacterPromptData` 타입 기반의 레이어 구조입니다.
데이터가 없는 레이어는 자동 생략됩니다.

```
[L1] 역할 설정      ← 캐릭터 이름 기반, 항상 포함
[L2] 성격 주입      ← personality 필드 (없으면 생략)
[L3] 배경 스토리    ← backgroundStory 필드 (없으면 생략)
[L4] 대화 스타일    ← tags 배열 기반 분위기 힌트 (없으면 생략)
[L5] 안전 가이드    ← 항상 포함 (고정 레이어)
[L6] 첫 인사말 힌트 ← firstMessage 필드 (없으면 생략)
```

### 1-2. 프롬프트 조립 코드 — `lib/ai/promptBuilder.ts`

```typescript
// 캐릭터 프롬프트 입력 타입
export type CharacterPromptData = {
  name: string;
  description?: string | null;
  personality?: string | null;
  backgroundStory?: string | null;
  firstMessage?: string | null;
  tags: string[];
};

// L1: 기본 역할 설정 (항상 포함)
function buildL1Role(name: string): string {
  return `너는 "${name}"이야. 지금부터 이 캐릭터로서 대화해줘. 항상 이 캐릭터의 말투와 태도를 유지해.`;
}

// L2: 성격 주입 (personality 있을 때만)
function buildL2Personality(personality: string | null | undefined): string;

// L3: 배경 스토리 (backgroundStory 있을 때만)
function buildL3Background(backgroundStory: string | null | undefined): string;

// L4: 대화 스타일 힌트 — tags 배열을 "#태그 #태그" 형식으로 변환
function buildL4Style(tags: string[]): string;

// L5: 안전 가이드라인 (항상 포함)
function buildL5Safety(): string;

// L6: 첫 인사말 힌트 (firstMessage 있을 때만)
function buildL6FirstMessage(firstMessage: string | null | undefined): string;

// 공개 진입점 — L1~L6 레이어를 "\n\n"로 결합하여 반환
export function buildCharacterSystemPrompt(
  character: CharacterPromptData
): string;
```

#### 키워드북 관련 유틸 (같은 파일 내 포함)

```typescript
export type KeywordEntry = { keyword: string; content: string };

// 사용자 메시지에서 키워드 감지 → 매칭된 content 목록 반환 (대소문자 무시)
export function detectKeywords(message: string, keywords: KeywordEntry[]): string[];

// 감지된 컨텍스트를 프롬프트 삽입 블록으로 포맷
export function buildKeywordContext(contents: string[]): string;

// 유저노트를 시스템 프롬프트 레이어로 변환
export function buildUserNoteLayer(note: string): string;
```

---

## 2. 캐릭터 채팅 에이전트

### 2-1. 역할 및 흐름

```
사용자 메시지
    ↓
메모리 로드 (DB → MemoryState)
    ↓
buildFullPrompt(L1~L6)
    ↓
streamClaude(prompt) → Socket.IO 청크 전송
    ↓
응답 완료 → DB 저장 → 메모리 업데이트 트리거
```

### 2-2. 캐릭터 에이전트 핸들러 — `socket-server/index.ts`

> 실제 구현은 `socket-server/index.ts` 단일 파일 (handlers/ 서브디렉토리 없음)

```typescript
import { Namespace, Socket } from "socket.io";
import { streamClaude } from "../../lib/ai/claude";
import { buildCharacterSystemPrompt } from "../../lib/ai/promptBuilder";
import { buildContextMessages } from "../../lib/memory";
import { prisma } from "../../lib/prisma";

// 핵심 흐름 요약 (실제 코드는 socket-server/index.ts 참조)
// 1. 캐릭터 설정 로드 (Character 모델)
// 2. 대화 기록 로드 → buildContextMessages()로 슬라이딩 윈도우 적용
// 3. buildCharacterSystemPrompt()로 시스템 프롬프트 조립
// 4. streamClaude(systemPrompt, messages) → Socket.IO chunk 이벤트 전송
// 5. 완료 후 Message 모델에 USER / ASSISTANT 메시지 저장
```

### 2-3. 5종 캐릭터 템플릿 (제작자가 선택)

| 템플릿 | AI 행동 모드 | persona 앞에 추가할 지시 |
|--------|-------------|--------------------------|
| **기본** | 범용, 상황 이해력 최대화 | `(추가 지시 없음)` |
| **1:1 롤플레잉** | 캐릭터 고정, 1인칭 감정 반응 | `"당신은 [이름]입니다. 절대 캐릭터를 이탈하지 마세요."` |
| **시뮬레이션** | 3인칭 GM, 다중 NPC 제어 | `"당신은 이 세계의 게임 마스터입니다. 여러 NPC를 동시에 제어하고 분기를 만드세요."` |
| **생산성** | 전문가 모드, 소설 문체 해제 | `"당신은 전문 지식을 기반으로 실용적 정보를 제공합니다. 소설 문체 규칙은 적용하지 않습니다."` |
| **커스텀** | L2 전체 자유 입력 | `(제작자 raw 프롬프트 그대로 사용)` |

---

## 3. 메모리 관리

### 3-1. 현재 구현 방식 — 슬라이딩 윈도우

현재 SAGA는 **슬라이딩 윈도우** 방식으로 메모리를 관리합니다.
별도의 `Memory` DB 모델은 없으며, `Message` 테이블의 최근 기록을 직접 사용합니다.

```
DB Message 테이블 (전체 대화 기록 영구 저장)
    ↓
buildContextMessages()  — 최근 CONTEXT_WINDOW_SIZE(20)개 추출
    ↓
Claude 메시지 배열로 변환 → streamClaude() 에 전달
```

### 3-2. 메모리 함수 — `lib/memory.ts`

```typescript
import type { ClaudeMessage } from "@/lib/ai/claude";

/** 컨텍스트 윈도우 크기: 최근 20개 메시지를 포함 */
export const CONTEXT_WINDOW_SIZE = 20;

export type MemoryMessage = {
  role: "USER" | "ASSISTANT" | "SYSTEM";
  content: string;
  createdAt: Date;
};

/**
 * DB 메시지 배열 → Claude 형식 변환
 * - SYSTEM 역할 메시지 제외
 * - 시간순 정렬 후 최근 CONTEXT_WINDOW_SIZE개만 사용
 */
export function buildContextMessages(messages: MemoryMessage[]): ClaudeMessage[];

/**
 * 컨텍스트를 단일 텍스트로 직렬화
 * (Claude CLI -p 방식 사용 시 대화 이력을 문자열로 전달할 때 사용)
 */
export function serializeContextToText(messages: ClaudeMessage[]): string;
```

### 3-3. 채팅 메시지 API — `app/api/chat/sessions/[sessionId]/messages/route.ts`

```
GET  /api/chat/sessions/[sessionId]/messages  — 메시지 목록 조회 (requireAuth)
POST /api/chat/sessions/[sessionId]/messages  — 메시지 저장 (requireAuth)
```

> 장기/단기/관계도/목표 4요소 DB 메모리 모델은 **향후 구현 예정** 기능입니다.
> 현재는 슬라이딩 윈도우로 대체 운용 중입니다.

---

## 4. 스토리 생성 에이전트

### 4-1. 스토리 플레이 — `app/api/stories/[id]/play-message/route.ts`

스토리 플레이 AI 응답은 `/api/stories/[id]/play-message` 경로에서 처리합니다.
플레이 세션은 `PlaySession` 모델로 관리하며, 대화 기록은 `PlayMessage` 모델에 저장합니다.

```
POST /api/stories/[id]/play-message  — 사용자 입력 → AI 응답 생성 (requireAuth)
```

플레이 세션 관련 API:
```
GET  /api/play-sessions          — 내 플레이 세션 목록
POST /api/play-sessions          — 새 플레이 세션 시작
GET  /api/play-sessions/[id]     — 세션 상세 + 메시지 조회
```

> `/api/generate/text` (SSE 스트리밍) 및 자동재생(`/api/autoplay`) 엔드포인트는
> **향후 구현 예정** 기능입니다.

### 4-2. 스토리 플레이 세션 DB 모델

```prisma
model PlaySession {
  id          String   @id @default(cuid())
  userId      String
  storyId     String
  chapterId   String
  branchId    String?
  playerSetup String   // JSON string (PlayerSetup)
  charStatus  String   // JSON string (CharacterStatus)
  turnCount   Int      @default(0)
  lastMessage String?  // 마지막 AI 응답 미리보기 (100자 이내)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user     User          @relation(...)
  story    Story         @relation(...)
  messages PlayMessage[]
}

model PlayMessage {
  id        String   @id @default(cuid())
  sessionId String
  role      String   // USER | ASSISTANT
  content   String
  choices   String?  // JSON string (string[])
  createdAt DateTime @default(now())

  session PlaySession @relation(...)
}
```

---

## 5. 이미지 생성 에이전트

### 5-1. 이미지 생성 API — `app/api/generate/image/route.ts`

```typescript
import { requireAuth } from "@/lib/rbac";
import fs from "fs/promises";
import path from "path";

export async function POST(req: Request) {
  await requireAuth();
  const { prompt, type } = await req.json();
  // type: "cover" | "scene" | "avatar"

  // 프롬프트 보강 (장르·스타일 자동 추가)
  const enhanced = enhancePrompt(prompt, type);

  try {
    // Stable Diffusion WebUI API (로컬, 무료)
    const res = await fetch(`${process.env.SD_WEBUI_URL}/sdapi/v1/txt2img`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: enhanced.positive,
        negative_prompt: enhanced.negative,
        width:  type === "cover" ? 512 : type === "avatar" ? 512 : 768,
        height: type === "cover" ? 768 : type === "avatar" ? 512 : 512,
        steps: 25,
        cfg_scale: 7,
        sampler_name: "DPM++ 2M Karras",
      }),
    });

    const data = await res.json();
    const buffer = Buffer.from(data.images[0], "base64");
    const filename = `${Date.now()}_${type}.png`;
    const savePath = path.join(process.cwd(), "public/uploads", type === "cover" ? "covers" : "avatars", filename);
    await fs.writeFile(savePath, buffer);

    return Response.json({
      url: `/uploads/${type === "cover" ? "covers" : "avatars"}/${filename}`,
    });
  } catch {
    return Response.json({ error: "이미지 생성 서버에 연결할 수 없습니다." }, { status: 503 });
  }
}

function enhancePrompt(prompt: string, type: string) {
  const base = {
    cover:  { positive: `${prompt}, webtoon cover art, korean manhwa style, high quality, detailed`,
               negative: "nsfw, ugly, blurry, low quality, text, watermark" },
    scene:  { positive: `${prompt}, digital illustration, cinematic, dramatic lighting`,
               negative: "nsfw, ugly, blurry, low quality" },
    avatar: { positive: `${prompt}, portrait, anime style, detailed face, clean background`,
               negative: "nsfw, ugly, blurry, deformed face" },
  };
  return base[type as keyof typeof base] ?? base.scene;
}
```

---

## 6. 키워드북 에이전트 (동적 컨텍스트 삽입)

특정 키워드 등장 시 관련 세계관 정보를 AI 컨텍스트에 자동 삽입합니다.

### 6-1. DB 스키마 — `Keyword` 모델

실제 스키마에는 `KeywordBook` 모델이 없습니다. `Keyword` 모델로 구현되어 있습니다.

```prisma
model Keyword {
  id          String    @id @default(cuid())
  characterId String
  keyword     String    // 트리거 키워드
  content     String    // 키워드 감지 시 삽입할 내용
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  character Character @relation(fields: [characterId], references: [id], onDelete: Cascade)

  @@index([characterId])
}
```

### 6-2. 키워드 감지 및 삽입 — `lib/ai/promptBuilder.ts`

키워드 관련 유틸은 별도 파일 없이 `lib/ai/promptBuilder.ts` 안에 포함되어 있습니다.

```typescript
// 사용자 메시지에서 키워드를 감지하여 매칭된 content 목록을 반환
export function detectKeywords(message: string, keywords: KeywordEntry[]): string[];

// 감지된 컨텍스트를 프롬프트 삽입 블록으로 포맷
export function buildKeywordContext(contents: string[]): string;
```

### 6-3. 키워드 CRUD API

```
GET    /api/characters/[id]/keywords          — 키워드 목록 조회
POST   /api/characters/[id]/keywords          — 키워드 추가
PATCH  /api/characters/[id]/keywords/[kwId]   — 키워드 수정
DELETE /api/characters/[id]/keywords/[kwId]   — 키워드 삭제
```

---

## 7. 프롬프트 조립 실전 예시

완성된 프롬프트가 실제로 어떻게 구성되는지 예시입니다.

```
[SYSTEM — 플랫폼 규칙]
당신은 SAGA 플랫폼의 AI 캐릭터입니다.
...행동·묘사는 **별표**로, 대화는 큰따옴표로...

---

[SYSTEM — 캐릭터 설정]
당신은 이준입니다.
성격: 냉정하고 말이 없으나 주인공에게만 약해지는 카리스마
말투: 짧고 직접적인 반말. '...알아서 해.' '왜 물어봐.'
직업: 재벌 2세, 그룹 총괄 이사
[키워드 참조: 회사] ← keywordBook 자동 삽입
이준의 회사는 JW그룹 IT 계열사. 직원 수 3,200명.

---

[SYSTEM — 메모리]
# 장기기억
- [1] 첫 만남: 카페에서 주인공이 이준의 노트북에 커피를 쏟음
- [2] 이준이 주인공을 비서로 채용함

# 단기기억 (최근 흐름 요약)
주인공이 첫 출근일에 중요 보고서를 잘못 제출하는 위기 상황

# 관계도
이준 → 주인공: 냉담하지만 미묘한 관심. 신뢰도 40%, 흥미 72%

# 현재 목표
주인공이 첫 실수를 만회하고 이준에게 인정받는 것

---

[SYSTEM — 사용자 설정]
# 대화 프로필
이름: 한채은 / 나이: 25세 / 성별: 여성 / 외형: 갈색 단발

# 유저노트
채은이가 긴장할 때 말을 더듬는 습관이 있어.
HUB는 반드시 답변 최하단에 출력할 것.

---

[대화 기록]
[사용자]
(채은이 보고서를 들고 이준의 사무실 앞에 서서 노크한다)
저...보고서 수정 완료했습니다.

[이준]
...들어와.
**그가 서류에서 눈을 떼지 않은 채 낮게 말했다.**

[사용자]
(현재 입력)

---

[출력 제어]
상태창(HUB/HUD)이 있다면 반드시 응답의 최하단에만 출력할 것.
한국어 전용 출력.
```

---

## 8. 타입 정의 — `types/agent.ts`

```typescript
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  characterName?: string;
}

export interface MemoryState {
  longTerm: string[];
  shortTerm: string;
  relationship: string;
  goal: string;
}

export interface UserProfile {
  name: string;
  age?: string;
  gender?: string;
  appearance?: string;
  userNote?: string;
}

export interface OutputControl {
  maxTokens?: number;
  hubPosition: "top" | "bottom";
  language: "ko";
}

// 에이전트 실행 모드
export type AgentMode = "roleplay" | "simulation" | "autoplay" | "story" | "productivity" | "custom";

// 캐릭터 DB → 에이전트 설정 매핑
export interface CharacterAgentConfig {
  characterId: string;
  name: string;
  persona: string;          // L2 원본
  templateType: AgentMode;  // 5종 템플릿
  maxTokens?: number;       // L6 출력량
  hubPosition?: "top" | "bottom";
}
```

---

## 9. 알려진 문제 & 해결책

분석에서 발견된 실제 LLM 에이전트 문제와 Saga에서의 대응 방식입니다.

| 문제 | 원인 | Saga 구현 대응 |
|------|------|----------------|
| **동일 답변 반복** | 상단 HUB 패턴이 토큰 선택 범위 제한 | `hubPosition: "bottom"` 기본값, 유저노트로 강제 |
| **CoT 누출** | AI 내부 추론 과정이 응답에 혼입 | L1에 `"내부 분석 과정 출력 금지"` 명시 |
| **외국어 혼재** | 의미 벡터 공간 언어 경계 불명확 | L1에 `"한국어 전용"` 명시 + L6 후처리 지시 |
| **메모리 맥락 고착** | 직전 대화 흐름 유지 → 주제 고착 | shortTerm을 1~2문장으로 제한, 갱신 주기 매턴 |
| **캐릭터 이탈** | 복잡한 지시 충돌 시 페르소나 해제 | L2 첫 줄에 `"당신은 [이름]입니다"` 강제 삽입 |

---

## 10. 에이전트별 파일 위치 요약

```
lib/
├── ai/
│   ├── claude.ts           → streamClaude / askClaude (Claude CLI 래퍼)
│   ├── promptBuilder.ts    → buildCharacterSystemPrompt / detectKeywords / buildKeywordContext / buildUserNoteLayer
│   └── sdwebui.ts          → generateImage (SD WebUI)
├── api-handler.ts          → API 공통 핸들러 유틸
├── auth.ts                 → NextAuth 설정
├── constants/
│   ├── genres.ts           → 장르 목록 10종
│   └── models.ts           → Claude 모델 상수
├── memory.ts               → buildContextMessages / serializeContextToText (슬라이딩 윈도우)
├── prisma.ts               → Prisma 클라이언트 싱글톤
├── rbac.ts                 → requireAuth / requireAdmin / requireOwnerOrAdmin
├── serializers/            → chapter / character / chat / story 직렬화
└── validators/             → chapter / character / chat / story 입력 검증

socket-server/
└── index.ts                → 실시간 캐릭터 채팅 에이전트 (단일 파일, handlers/ 없음)

app/api/
├── admin/stats/            → 관리자 통계
├── auth/[...nextauth]/     → NextAuth 핸들러
├── auth/register/          → 회원가입
├── characters/[id]/
│   ├── keywords/           → 키워드 목록·추가
│   └── keywords/[kwId]/    → 키워드 수정·삭제
├── characters/[id]/        → 캐릭터 상세·수정·삭제
├── characters/             → 캐릭터 목록·생성
├── chat/sessions/[sessionId]/messages/ → 메시지 조회·저장
├── chat/sessions/[sessionId]/          → 세션 상세
├── chat/sessions/                      → 세션 목록·생성
├── generate/image/         → 이미지 생성 (SD WebUI)
├── play-sessions/[id]/     → 플레이 세션 상세
├── play-sessions/          → 플레이 세션 목록·생성
├── stories/[id]/bookmark/  → 북마크 토글
├── stories/[id]/chapters/[chapterId]/ → 챕터 상세·수정·삭제
├── stories/[id]/chapters/  → 챕터 목록·추가
├── stories/[id]/like/      → 좋아요 토글
├── stories/[id]/play-message/ → 플레이 메시지 AI 응답
├── stories/[id]/           → 스토리 상세·수정·삭제
├── stories/                → 스토리 목록·생성
└── users/me/               → 북마크·캐릭터·스토리 내 목록

> `/api/generate/text` (SSE 스트리밍), `/api/memory/`, `/api/autoplay/` 엔드포인트는
> **향후 구현 예정** 기능입니다.
```

---

*SAGA 에이전트구성 v1.1 — 2026-05-16 실제 코드베이스 기준 업데이트*
