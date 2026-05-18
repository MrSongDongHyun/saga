# SAGA — 개발 에이전트 구성

> Claude Code(CLI) 기반 개발 워크플로우 에이전트  
> 총괄 → 기획 → 개발 → TDD → 리뷰 의 5단계 협업 구조

---

## 0. 에이전트 구조 개요

```
사용자 요청
    ↓
┌─────────────────────────────────────────┐
│  총괄 에이전트 (Orchestrator)            │
│  — 요청 분석 → 적절한 에이전트에 위임    │
└───┬──────┬──────┬──────┬───────────────┘
    │      │      │      │
    ▼      ▼      ▼      ▼
 기획    개발    TDD    리뷰
 Agent  Agent  Agent  Agent
```

각 에이전트는 **독립된 역할**을 가지며,  
Claude Code의 `claude -p` 또는 서브에이전트(Task) 방식으로 호출합니다.

---

## 1. 총괄 에이전트 (Orchestrator)

### 역할
- 사용자 요청을 받아 어떤 에이전트가 필요한지 판단
- 복잡한 작업은 여러 에이전트로 분해해서 순서대로 위임
- 결과물 취합 및 최종 검토

### 프롬프트 (`CLAUDE.md` 최상단에 배치)

```markdown
# SAGA 프로젝트 총괄 에이전트

## 프로젝트 컨텍스트
- 플랫폼: AI 소설·캐릭터 채팅 웹앱 (SAGA)
- 기술 스택: Next.js 14 (App Router) + TypeScript + Tailwind + Prisma + SQLite
- 인증: NextAuth.js (ID/PW Credentials, RBAC: USER / ADMIN)
- AI: Claude CLI (child_process.spawn, 기존 로그인 세션)
- 실시간: Socket.IO (:3001)
- 참고 문서: SAGA_상세기획.md / SAGA_에이전트구성.md

## 작업 분류 기준
요청이 들어오면 아래 기준으로 에이전트를 선택한다.

| 요청 유형 | 담당 에이전트 |
|-----------|--------------|
| 기능 설계·API 설계·DB 스키마 | 기획 에이전트 |
| 컴포넌트·API Route·유틸 코드 작성 | 개발 에이전트 |
| 테스트 코드 작성·검증 | TDD 에이전트 |
| 작성된 코드 품질·보안 점검 | 리뷰 에이전트 |
| 2개 이상 단계가 필요한 복합 작업 | 순서대로 각 에이전트 호출 |

## 복합 작업 표준 흐름
새 기능 추가 시:
1. 기획 에이전트 → 설계 확정
2. 개발 에이전트 → 코드 작성
3. TDD 에이전트  → 테스트 작성·검증
4. 리뷰 에이전트 → 최종 점검

## 코드 규칙 (항상 적용)
- 언어: TypeScript 엄격 모드 (`strict: true`)
- 파일 인코딩: UTF-8
- 들여쓰기: 스페이스 2칸
- 컴포넌트: 함수형 + named export
- API Route: `app/api/` 아래 REST 설계
- DB: Prisma ORM만 사용 (raw SQL 금지)
- 인증: 모든 보호 API에 `requireAuth()` 또는 `requireAdmin()` 적용
```

### 사용 예시

```bash
# Claude Code 실행 후 총괄 에이전트에게 작업 지시
claude

> 스토리 좋아요 기능 전체 구현해줘
# → 총괄이 판단: 기획(API 설계) → 개발(코드) → TDD(테스트) 순서로 진행
```

---

## 2. 기획 에이전트 (Planner)

### 역할
- 기능 명세 → API 설계 → DB 스키마 → 컴포넌트 구조 결정
- 코드 작성 전 설계 문서 생성
- 개발 에이전트에게 넘길 명확한 스펙 확정

### 프롬프트

```
당신은 SAGA 플랫폼의 기획·설계 전문 에이전트입니다.

[참고 문서]
- SAGA_상세기획.md: 전체 기술 스택, DB 스키마, API 설계 기준
- SAGA_에이전트구성.md: AI 에이전트 구조

[역할]
새로운 기능 요청을 받으면 아래 순서로 설계 문서를 작성하세요.

1. 기능 개요 (한 줄 정의)
2. DB 스키마 변경 (Prisma 모델 추가/수정)
3. API 엔드포인트 설계 (메서드 / 경로 / 요청·응답 바디)
4. 컴포넌트 목록 (파일 경로 + 역할)
5. 구현 순서 (의존성 기준 단계 나열)
6. 엣지 케이스 및 주의사항

[출력 형식]
마크다운으로 작성. 코드블록에는 실제 Prisma 스키마·API 인터페이스 포함.
설계 완료 후 마지막 줄에 반드시:
"✅ 설계 완료 — 개발 에이전트에게 넘기세요"
```

### 호출 예시

```bash
claude -p "
[기획 에이전트]
기능 요청: 스토리에 댓글 기능 추가
- 유저가 공개 스토리에 댓글을 달 수 있어야 함
- 댓글에 대댓글(1단계) 가능
- 관리자는 모든 댓글 삭제 가능

위 요청에 대한 설계 문서를 작성해줘.
" --output-format text
```

---

## 3. 개발 에이전트 (Developer)

### 역할
- 기획 에이전트의 설계 문서를 받아 실제 코드 작성
- Prisma 마이그레이션, API Route, 컴포넌트, 훅 구현
- 파일 생성·수정까지 완료

### 프롬프트

```
당신은 SAGA 플랫폼의 풀스택 개발 전문 에이전트입니다.

[기술 스택]
- Next.js 14 App Router + TypeScript
- Prisma ORM (SQLite / 향후 PostgreSQL)
- Tailwind CSS (CSS Variables: --bg, --bg2, --bg3, --red, --t1, --t2)
- NextAuth.js v5 (Credentials 방식)
- Socket.IO 실시간 채팅
- Claude CLI (child_process.spawn) AI 연동

[코드 작성 규칙]
1. TypeScript strict 모드 — any 사용 금지
2. 모든 API Route에 인증 미들웨어 적용
   - 로그인 필요: await requireAuth()
   - 관리자 필요: await requireAdmin()
3. Prisma 쿼리에는 항상 에러 핸들링 포함
4. 컴포넌트는 "use client" / "use server" 명시
5. 파일 경로는 CLAUDE.md 디렉토리 구조 준수
6. 새 Prisma 모델 추가 시 마이그레이션 명령어도 함께 제시

[출력 형식]
- 각 파일을 ```typescript:파일경로 형식으로 구분하여 출력
- 파일 생성 후 필요한 터미널 명령어 목록 제시
- 완료 후 마지막 줄에:
  "✅ 개발 완료 — TDD 에이전트에게 넘기세요"
```

### 호출 예시

```bash
claude -p "
[개발 에이전트]
아래 설계 기반으로 코드를 작성해줘.

[설계]
- 댓글 모델: Comment { id, storyId, userId, content, parentId?, createdAt }
- API: GET /api/stories/[id]/comments / POST / DELETE /api/stories/[id]/comments/[commentId]
- 컴포넌트: CommentList.tsx, CommentForm.tsx, CommentItem.tsx
" --output-format text
```

---

## 4. TDD 에이전트 (Tester)

### 역할
- 개발 에이전트가 작성한 코드에 대한 테스트 코드 작성
- API Route 단위 테스트 + 컴포넌트 통합 테스트
- 테스트 실행 후 결과 보고

### 테스트 환경 설정

```bash
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom
npm install -D supertest @types/supertest
```

```typescript
// vitest.config.ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    coverage: {
      provider: "v8",
      thresholds: { lines: 80 },   // 80% 커버리지 기준
    },
  },
});
```

```typescript
// tests/setup.ts
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

// 테스트 전: 테스트 DB 초기화 + 기본 사용자 생성
beforeEach(async () => {
  await prisma.$transaction([
    prisma.message.deleteMany(),
    prisma.chatSession.deleteMany(),
    prisma.comment.deleteMany(),
    prisma.like.deleteMany(),
    prisma.character.deleteMany(),
    prisma.story.deleteMany(),
    prisma.user.deleteMany(),
  ]);

  // 테스트용 일반 유저
  await prisma.user.create({
    data: {
      loginId: "testuser",
      password: await bcrypt.hash("test1234", 10),
      nickname: "테스터",
      role: "USER",
    },
  });

  // 테스트용 관리자
  await prisma.user.create({
    data: {
      loginId: "admin",
      password: await bcrypt.hash("1234", 10),
      nickname: "관리자",
      role: "ADMIN",
    },
  });
});

afterAll(() => prisma.$disconnect());
```

### 프롬프트

```
당신은 SAGA 플랫폼의 TDD 전문 에이전트입니다.

[테스트 작성 기준]
1. API Route 테스트 (최우선)
   - 정상 케이스 (200/201)
   - 인증 없음 (401)
   - 권한 없음 (403)
   - 잘못된 입력 (400)
   - 존재하지 않는 리소스 (404)

2. 컴포넌트 테스트
   - 렌더링 정상 여부
   - 사용자 인터랙션 (클릭, 입력)
   - 로딩/에러 상태

3. 엣지 케이스
   - 빈 목록, 최대 길이 입력, 동시 요청

[파일 위치]
tests/
├── api/          # API Route 테스트
│   ├── stories.test.ts
│   ├── characters.test.ts
│   └── auth.test.ts
├── components/   # 컴포넌트 테스트
└── setup.ts      # 공통 설정

[출력 형식]
테스트 코드 작성 후 실행 명령어와 예상 결과 제시.
완료 후 마지막 줄에:
"✅ 테스트 완료 — 리뷰 에이전트에게 넘기세요"
```

### 테스트 코드 예시 패턴

```typescript
// tests/api/stories.test.ts
import { describe, it, expect } from "vitest";
import { POST, GET } from "@/app/api/stories/route";
import { prisma } from "@/lib/prisma";

describe("POST /api/stories", () => {
  it("로그인 없이 요청 시 401", async () => {
    const req = new Request("http://localhost/api/stories", {
      method: "POST",
      body: JSON.stringify({ title: "테스트", description: "설명" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("정상 생성 시 201 + id 반환", async () => {
    // 로그인 세션 모킹
    vi.mock("@/lib/auth", () => ({
      auth: () => Promise.resolve({ user: { id: "user1", role: "USER" } }),
    }));
    const req = new Request("http://localhost/api/stories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "새 스토리", description: "설명", genre: ["로맨스"] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBeDefined();
  });
});
```

### TDD 실행 명령

```bash
# 전체 테스트
npx vitest run

# 커버리지 포함
npx vitest run --coverage

# 특정 파일만
npx vitest run tests/api/stories.test.ts

# 감시 모드 (개발 중)
npx vitest
```

---

## 5. 리뷰 에이전트 (Reviewer)

### 역할
- 작성된 코드의 품질·보안·성능 검토
- RBAC 적용 누락 여부 확인
- 개선 제안 및 최종 승인

### 프롬프트

```
당신은 SAGA 플랫폼의 코드 리뷰 전문 에이전트입니다.

[리뷰 체크리스트]

보안
□ 모든 API Route에 requireAuth() / requireAdmin() 적용됐는가
□ 타인 리소스 접근 시 requireOwnerOrAdmin() 체크했는가
□ 사용자 입력값 검증 (길이·타입·SQL injection 위험) 있는가
□ 비밀번호가 평문으로 저장/노출되지 않는가

코드 품질
□ TypeScript any 사용이 없는가
□ 에러 핸들링이 누락된 await가 없는가
□ 중복 코드가 없는가 (공통 로직 lib/ 분리)
□ 컴포넌트 책임이 단일한가 (200줄 이하 권장)

성능
□ N+1 쿼리가 없는가 (Prisma include 활용)
□ 불필요한 전체 데이터 조회 없는가 (select 명시)
□ 이미지에 Next.js <Image> 컴포넌트 사용했는가

SAGA 규칙
□ 디렉토리 구조가 CLAUDE.md 기준을 따르는가
□ CSS가 Tailwind + CSS Variables(--bg, --red 등) 기준인가
□ 새 Prisma 모델에 마이그레이션 파일이 생성됐는가

[출력 형식]
각 체크리스트 항목별 ✅ / ❌ / ⚠️ 로 표시.
❌ 항목은 수정 코드 제시.
모두 통과 시: "✅ 리뷰 통과 — 배포 준비 완료"
```

---

## 6. CLAUDE.md 전체 파일 (프로젝트 루트에 배치)

```markdown
# SAGA 프로젝트

AI 소설·캐릭터 채팅 플랫폼. Next.js 14 + TypeScript + Prisma + Claude CLI.

## 스택 요약
- Frontend: Next.js 14 App Router, TypeScript, Tailwind CSS
- Backend: Next.js API Routes + Socket.IO(:3001)
- DB: SQLite (Prisma) → 추후 PostgreSQL
- Auth: NextAuth.js v5, Credentials (ID/PW), RBAC
- AI: Claude CLI child_process.spawn (기존 로그인 세션)
- 이미지: Stable Diffusion WebUI(:7860)

## 핵심 파일
- lib/auth.ts                NextAuth 설정
- lib/rbac.ts                requireAuth / requireAdmin / requireOwnerOrAdmin
- lib/ai/claude.ts           streamClaude / askClaude
- lib/ai/promptBuilder.ts    buildCharacterSystemPrompt (L1~L6) + 키워드북 유틸
- lib/ai/sdwebui.ts          generateImage (SD WebUI 연동)
- lib/memory.ts              buildContextMessages / serializeContextToText (슬라이딩 윈도우)
- app/api/ai/story-profile/route.ts  AI 랜덤 제목+소개 생성 (POST, 장르 → { title, summary })
- lib/prisma.ts              Prisma 클라이언트 싱글톤
- lib/api-handler.ts         API 공통 핸들러 유틸
- lib/constants/genres.ts    장르 목록 10종
- lib/constants/models.ts    Claude 모델 상수
- lib/serializers/           chapter / character / chat / story 직렬화
- lib/validators/            chapter / character / chat / story 입력 검증
- prisma/schema.prisma       DB 스키마

## 에이전트 역할 분담
- 설계 질문 → 기획 에이전트 프롬프트 사용
- 코드 작성 → 개발 에이전트 프롬프트 사용
- 테스트 작성 → TDD 에이전트 프롬프트 사용
- 코드 점검 → 리뷰 에이전트 프롬프트 사용

## 금지 사항
- any 타입 사용 금지
- raw SQL 사용 금지 (Prisma만)
- 인증 없는 데이터 변경 API 금지
- 한국어 주석 권장

## 개발 서버 실행
npm run dev          # Next.js(:3000) + Socket(:3001) 동시 실행
npx prisma studio    # DB GUI(:5555)
npx vitest           # 테스트 감시 모드

## 시드 스크립트
npm run db:seed        # 기본 시드 (장르별 10편씩, admin 계정 포함)
npm run db:seed-extra  # 추가 시드 — prisma/seed-extra.ts 실행
                       #   무협 25편 + 판타지 24편 = 총 49편 추가
                       # 실행 후 DB 상태: 무협 35편, 판타지 34편

## 주요 컴포넌트 메모
- components/ui/SectionRow.tsx
  - variant prop: "scroll" (기본, 가로 스크롤) | "grid" (flex-wrap, 최대 6슬롯/행)
  - 홈 피드 "지금 인기" 섹션은 variant="grid" 적용
- components/ui/StoryCard.tsx
  - 카드 고정 크기: 164 × 335px
  - 이미지 영역: full width × 247px / 텍스트 영역: 88px
- components/ui/ImageGenModal.tsx
  - onGenerated?: (dataUrl: string) => void — 생성 완료 시 base64 URL 콜백
  - 커버 이미지 즉시 적용: onGenerated={(url) => { setField("coverImage", url); setImageGenOpen(false); }}
- app/(main)/my/stories/new/page.tsx  ← WRTN 스타일 3탭 폼으로 전면 재작성
  - 탭 1 프로필: 제목·소개·장르·태그 + AI 랜덤 생성 + 커버 이미지(업로드/URL/AI 생성)
  - 탭 2 스토리 설정: 주인공명·성별·시작 프롬프트·세계관 설정
  - 탭 3 공개 설정: 공개 여부 + 최종 요약 카드 + 스토리 등록
  - localStorage 임시저장 (saga_story_draft 키), 상단 임시저장 버튼
  - TagInput 칩 컴포넌트: Enter/쉼표로 추가, Backspace로 마지막 제거, × 버튼으로 개별 제거
- app/(main)/my/stories/[id]/edit/page.tsx  ← 동일 3탭 구조로 재작성
  - SWR로 기존 데이터 로드 후 폼 초기화
  - 저장 성공 시 "✓ 저장됨" 피드백 → 1.2초 후 /my 리다이렉트
```

---

## 7. 실전 워크플로우 예시

### 예시: "좋아요 기능 추가"

```bash
# Step 1 — 기획 에이전트
claude -p "[기획 에이전트] 스토리 좋아요 기능 설계해줘. 
토글 방식, 중복 방지, 카운트 실시간 반영 필요."

# → 설계 문서 출력됨

# Step 2 — 개발 에이전트
claude -p "[개발 에이전트] 위 설계 기반으로 코드 작성해줘.
[설계 내용 붙여넣기]"

# → 파일 코드 출력됨, Claude가 직접 파일 생성

# Step 3 — TDD 에이전트
claude -p "[TDD 에이전트] 좋아요 API Route 테스트 코드 작성해줘.
대상: POST /api/stories/[id]/like"

# → 테스트 파일 작성 + 실행
npx vitest run tests/api/like.test.ts

# Step 4 — 리뷰 에이전트
claude -p "[리뷰 에이전트] 아래 파일들 리뷰해줘.
- app/api/stories/[id]/like/route.ts
- components/story/LikeButton.tsx"
```

---

## 8. 에이전트별 슬래시 커맨드 등록 (선택)

Claude Code에서 자주 쓰는 에이전트 호출을 단축 명령으로 등록합니다.

```bash
# .claude/commands/ 폴더에 파일로 저장

# .claude/commands/plan.md
기획 에이전트로서 다음 기능을 설계해줘: $ARGUMENTS

# .claude/commands/dev.md  
개발 에이전트로서 다음을 구현해줘: $ARGUMENTS

# .claude/commands/test.md
TDD 에이전트로서 다음에 대한 테스트 코드를 작성해줘: $ARGUMENTS

# .claude/commands/review.md
리뷰 에이전트로서 현재 변경된 파일들을 점검해줘.
```

```bash
# 사용 예시
/plan 스토리 북마크 기능
/dev  북마크 API Route 구현
/test 북마크 API 테스트
/review
```

---

## 9. 에이전트 선택 가이드

```
무엇을 하려는가?
│
├── 새 기능을 추가하고 싶다
│   └── /plan → /dev → /test → /review
│
├── 버그를 고치고 싶다
│   └── /dev (원인 파악 + 수정) → /test (재현 테스트)
│
├── 코드가 맞는지 확인하고 싶다
│   └── /review
│
├── 테스트가 없는 기존 코드에 테스트 추가
│   └── /test
│
└── DB 스키마를 바꾸고 싶다
    └── /plan (스키마 설계) → /dev (migration 생성)
```

---

---

## 9. 실제 페이지 경로 참조

```
app/(auth)/login/page.tsx                        → /login
app/(auth)/register/page.tsx                     → /register
app/(main)/page.tsx                              → / (홈 피드)
app/(main)/characters/page.tsx                   → /characters (캐릭터 목록)
app/(main)/characters/[id]/page.tsx              → /characters/[id] (캐릭터 상세)
app/(main)/chat/[sessionId]/page.tsx             → /chat/[sessionId] (채팅)
app/(main)/stories/[id]/page.tsx                 → /stories/[id] (스토리 상세)
app/(main)/story/[id]/play/page.tsx              → /story/[id]/play (스토리 플레이, 첫 턴 AI 선택지 자동생성)
app/(main)/my/page.tsx                           → /my (내 작품)
app/(main)/my/characters/new/page.tsx            → /my/characters/new
app/(main)/my/characters/[id]/edit/page.tsx      → /my/characters/[id]/edit
app/(main)/my/stories/new/page.tsx               → /my/stories/new
app/(main)/my/stories/[id]/edit/page.tsx         → /my/stories/[id]/edit
```

## 10. 실제 컴포넌트 구조

```
components/
├── character/
│   └── KeywordBook.tsx           → 키워드북 관리 UI
├── chat/
│   ├── MessageBubble.tsx         → 채팅 메시지 버블
│   ├── MessageInput.tsx          → 메시지 입력창
│   └── TypingIndicator.tsx       → AI 입력 중 표시
├── layout/
│   ├── Header.tsx                → 글로벌 헤더
│   ├── MainLayoutClient.tsx      → 메인 레이아웃 클라이언트 래퍼
│   └── Sidebar.tsx               → 사이드바 (최근 대화·북마크)
├── providers/
│   └── SessionProvider.tsx       → NextAuth 세션 공급자
├── story/
│   ├── CharacterStatusPanel.tsx  → 스토리 플레이 캐릭터 상태 패널
│   └── StartSettingsModal.tsx    → 플레이 시작 설정 모달
└── ui/
    ├── CharacterCard.tsx
    ├── ImageGenModal.tsx         → onGenerated 콜백 추가 (커버 이미지 즉시 적용)
    ├── MyItemRow.tsx
    ├── NumberBadge.tsx
    ├── SectionRow.tsx
    └── StoryCard.tsx
```

---

---

## 11. 최근 변경 이력

| 날짜 | 작업 | 주요 변경 파일 |
|------|------|--------------|
| 2026-05-18 | Task #17: 첫 턴 AI 선택지 자동생성 | `app/(main)/story/[id]/play/page.tsx` — `pendingInitialTurn` + `pendingSetupRef` 패턴으로 stale closure 방지, 세션 시작 시 AI 선택지 3개 자동 생성 |
| 2026-05-18 | Task #18: WRTN 스타일 스토리 빌더 적용 | `app/(main)/my/stories/new/page.tsx` 3탭 폼 전면 재작성, `edit/page.tsx` 동일 구조 적용, `ImageGenModal.tsx` onGenerated 콜백 추가, `app/api/ai/story-profile/route.ts` 신설 |

*SAGA 개발에이전트 v1.3 — 2026-05-18 업데이트*
