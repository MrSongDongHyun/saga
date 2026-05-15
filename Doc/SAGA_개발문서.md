# SAGA — AI 소설·캐릭터 채팅 플랫폼 개발 문서

> **개인 PC 베타 운용 기준** | 무료 스택 | 로컬 우선 설계  
> 최종 업데이트: 2026-05-16 (2차)

---

## 1. 기술 스택

| 항목 | 선택 | 비고 |
|------|------|------|
| **프레임워크** | Next.js 14 (App Router) | SSR + API Routes |
| **언어** | TypeScript (strict) | |
| **스타일** | Tailwind CSS | CSS Variables 테마 |
| **상태관리** | SWR | 서버 상태 캐싱 |
| **ORM** | Prisma | SQLite (개발) |
| **인증** | NextAuth.js v5 | Credentials (ID/PW), RBAC |
| **AI** | Claude CLI | `child_process.spawn`, 기존 로그인 세션 |
| **실시간** | Socket.IO (:3001) | 캐릭터 채팅 스트리밍 |
| **이미지 생성** | Stable Diffusion WebUI (:7860) | 선택 |

---

## 2. 전체 아키텍처

```
┌─────────────────────────────────────────────────────────┐
│                    개인 PC (로컬호스트)                    │
│                                                         │
│  ┌──────────────────────┐   ┌──────────────────────┐   │
│  │  Next.js :3000       │   │  Socket Server :3001  │   │
│  │  - 페이지 SSR         │   │  - 캐릭터 채팅 스트림  │   │
│  │  - API Routes        │   └──────────────────────┘   │
│  └──────────┬───────────┘                               │
│             │                                           │
│  ┌──────────▼────────────────────────────────────────┐  │
│  │              SQLite (prisma/saga.db)               │  │
│  └────────────────────────────────────────────────────┘  │
│                                                         │
│  ┌──────────────────────────┐   ┌──────────────────────┐ │
│  │  Claude CLI (로컬 프로세스) │   │  SD WebUI :7860      │ │
│  │  child_process.spawn()   │   │  - 캐릭터 이미지 생성  │ │
│  └──────────────────────────┘   └──────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## 3. 디렉토리 구조 (실제 구현)

```
saga/
├── app/
│   ├── (auth)/
│   │   ├── layout.tsx
│   │   ├── login/page.tsx               # ID/PW 로그인
│   │   └── register/page.tsx            # 회원가입
│   ├── (main)/
│   │   ├── layout.tsx                   # 헤더 + 사이드바 레이아웃
│   │   ├── page.tsx                     # 홈 (스토리 목록)
│   │   ├── characters/
│   │   │   ├── page.tsx                 # 캐릭터 목록
│   │   │   └── [id]/page.tsx            # 캐릭터 상세
│   │   ├── chat/
│   │   │   └── [sessionId]/page.tsx     # 캐릭터 채팅
│   │   ├── stories/
│   │   │   └── [id]/page.tsx            # 스토리 상세
│   │   ├── story/
│   │   │   └── [id]/play/page.tsx       # 스토리 플레이 (인터랙티브)
│   │   └── my/
│   │       ├── page.tsx                 # 내 작품 (스토리+캐릭터)
│   │       ├── stories/new/page.tsx     # 스토리 생성
│   │       ├── stories/[id]/edit/page.tsx
│   │       ├── characters/new/page.tsx  # 캐릭터 생성
│   │       └── characters/[id]/edit/page.tsx
│   ├── api/
│   │   ├── auth/register/route.ts       # 회원가입
│   │   ├── admin/stats/route.ts         # 관리자 통계
│   │   ├── stories/
│   │   │   ├── route.ts                 # GET(목록) POST(생성)
│   │   │   └── [id]/
│   │   │       ├── route.ts             # GET PUT DELETE
│   │   │       ├── like/route.ts        # 좋아요 토글
│   │   │       ├── bookmark/route.ts    # 북마크 토글
│   │   │       ├── play-message/route.ts # 스토리 플레이 AI 응답
│   │   │       └── chapters/
│   │   │           ├── route.ts         # 챕터 목록/생성
│   │   │           └── [chapterId]/route.ts
│   │   ├── characters/
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   │       ├── route.ts
│   │   │       └── keywords/
│   │   │           ├── route.ts         # 키워드북 목록/생성
│   │   │           └── [kwId]/route.ts  # 키워드 수정/삭제
│   │   ├── chat/sessions/
│   │   │   ├── route.ts                 # 채팅 세션 목록
│   │   │   └── [sessionId]/
│   │   │       ├── route.ts             # 세션 상세
│   │   │       └── messages/route.ts    # 메시지 전송/조회
│   │   ├── play-sessions/
│   │   │   ├── route.ts                 # GET(목록) POST(생성)
│   │   │   └── [id]/route.ts            # GET(상세) PATCH(업데이트)
│   │   ├── generate/image/route.ts      # SD WebUI 이미지 생성
│   │   └── users/me/
│   │       ├── bookmarks/route.ts
│   │       ├── stories/route.ts
│   │       └── characters/route.ts
│   └── layout.tsx
│
├── components/
│   ├── layout/
│   │   ├── Header.tsx
│   │   ├── Sidebar.tsx                  # 에피소드(채팅+플레이 합산) — 항상 표시
│   │   └── MainLayoutClient.tsx
│   ├── story/
│   │   ├── StartSettingsModal.tsx       # 플레이 시작 설정 (세력·캐릭터)
│   │   └── CharacterStatusPanel.tsx     # 우측 STATUS 패널 + parseAIResponse
│   ├── character/
│   │   └── KeywordBook.tsx              # 키워드북 관리 UI
│   ├── chat/
│   │   ├── MessageBubble.tsx
│   │   ├── MessageInput.tsx
│   │   └── TypingIndicator.tsx
│   ├── providers/
│   │   └── SessionProvider.tsx
│   └── ui/
│       ├── StoryCard.tsx
│       ├── CharacterCard.tsx
│       ├── ImageGenModal.tsx            # SD WebUI 이미지 생성 모달
│       ├── MyItemRow.tsx
│       ├── NumberBadge.tsx
│       └── SectionRow.tsx
│
├── lib/
│   ├── prisma.ts                        # Prisma 클라이언트 싱글톤
│   ├── auth.ts                          # NextAuth Credentials 설정
│   ├── rbac.ts                          # requireAuth / requireAdmin / requireOwnerOrAdmin
│   ├── api-handler.ts                   # withHandler / withDynamicHandler 래퍼
│   ├── memory.ts                        # 메모리 4요소 로드/저장
│   └── ai/
│       ├── claude.ts                    # streamClaude / askClaude
│       ├── promptBuilder.ts             # L1~L6 프롬프트 조립
│       └── sdwebui.ts                   # SD WebUI 이미지 생성 래퍼
│
├── prisma/
│   ├── schema.prisma
│   ├── seed.ts
│   └── saga.db                          # SQLite DB
│
├── socket-server/
│   └── index.ts                         # Socket.IO 캐릭터 채팅 서버
│
└── Doc/
    ├── SAGA_개발문서.md                  # 이 파일
    ├── SAGA_개발에이전트.md
    ├── SAGA_에이전트구성.md
    └── SAGA_상세기획.md
```

---

## 4. 데이터베이스 스키마 (현재 실제)

```prisma
// SQLite 기반, 향후 PostgreSQL 마이그레이션 예정

model User {
  id           String        @id @default(cuid())
  loginId      String        @unique
  password     String
  nickname     String        @unique
  role         String        @default("USER")   // "USER" | "ADMIN"
  isActive     Boolean       @default(true)
  profileImage String?
  bio          String?
  createdAt    DateTime      @default(now())
  updatedAt    DateTime      @updatedAt

  stories      Story[]
  characters   Character[]
  chatSessions ChatSession[]
  playSessions PlaySession[]
  likes        Like[]
  bookmarks    Bookmark[]
}

model Story {
  id          String        @id @default(cuid())
  title       String
  description String?
  genre       String        // JSON 배열 문자열 ["무협","판타지"]
  tags        String        // JSON 배열 문자열
  status      String        @default("ONGOING")
  visibility  String        @default("PUBLIC")
  coverImage  String?
  viewCount   Int           @default(0)
  authorId    String
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  author       User          @relation(...)
  chapters     Chapter[]
  likes        Like[]
  bookmarks    Bookmark[]
  playSessions PlaySession[]
}

model Chapter {
  id          String   @id @default(cuid())
  storyId     String
  title       String
  content     String
  orderIndex  Int
  isPublished Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  story Story @relation(...)
}

model Character {
  id              String   @id @default(cuid())
  name            String
  description     String?
  personality     String?
  backgroundStory String?
  firstMessage    String?
  avatar          String?
  tags            String
  visibility      String   @default("PUBLIC")
  creatorId       String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  creator      User          @relation(...)
  chatSessions ChatSession[]
  keywords     Keyword[]
}

model Keyword {
  id          String   @id @default(cuid())
  characterId String
  keyword     String
  content     String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  character Character @relation(...)
}

// 캐릭터 채팅 세션
model ChatSession {
  id          String   @id @default(cuid())
  userId      String
  characterId String
  title       String?
  model       String   @default("claude-sonnet-4-6")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user      User      @relation(...)
  character Character @relation(...)
  messages  Message[]
}

model Message {
  id        String   @id @default(cuid())
  sessionId String
  role      String   // "USER" | "ASSISTANT"
  content   String
  createdAt DateTime @default(now())

  session ChatSession @relation(...)
}

// 스토리 플레이 세션 (인터랙티브 소설)
model PlaySession {
  id          String   @id @default(cuid())
  userId      String
  storyId     String
  chapterId   String
  branchId    String?
  playerSetup String   // JSON: { name, gender, factionType, faction, background }
  charStatus  String   // JSON: CharacterStatus 전체
  turnCount   Int      @default(0)
  lastMessage String?  // 마지막 AI 응답 미리보기 (100자)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user     User         @relation(...)
  story    Story        @relation(...)
  messages PlayMessage[]
}

model PlayMessage {
  id        String   @id @default(cuid())
  sessionId String
  role      String   // "USER" | "ASSISTANT"
  content   String
  choices   String?  // JSON: string[] 선택지
  createdAt DateTime @default(now())

  session PlaySession @relation(...)
}

model Like {
  id        String   @id @default(cuid())
  userId    String
  storyId   String
  createdAt DateTime @default(now())

  user  User  @relation(...)
  story Story @relation(...)

  @@unique([userId, storyId])
}

model Bookmark {
  id        String   @id @default(cuid())
  userId    String
  storyId   String
  createdAt DateTime @default(now())

  user  User  @relation(...)
  story Story @relation(...)

  @@unique([userId, storyId])
}
```

### 마이그레이션 이력

| 마이그레이션 | 내용 |
|-------------|------|
| `20260515090114_init` | 초기 스키마 (User, Story, Chapter, Character, ChatSession, Message, Like, Bookmark) |
| `20260515124559_add_keyword` | Keyword 모델 추가 (캐릭터 키워드북) |
| `20260515140131_add_chat_session_model` | ChatSession 모델 보완 |
| `20260515140925_add_play_session` | PlaySession, PlayMessage 모델 추가 |

---

## 5. API 엔드포인트 (실제 구현)

### 인증
```
POST /api/auth/register          회원가입 { loginId, password, nickname }
POST /api/auth/[...nextauth]     NextAuth 로그인/로그아웃
```

### 스토리
```
GET    /api/stories              목록 (genre, sort, page, visibility 쿼리)
POST   /api/stories              생성 [AUTH]
GET    /api/stories/:id          상세
PUT    /api/stories/:id          수정 [AUTH, OWNER]
DELETE /api/stories/:id          삭제 [AUTH, OWNER]
POST   /api/stories/:id/like     좋아요 토글 [AUTH]
POST   /api/stories/:id/bookmark 북마크 토글 [AUTH]
```

### 챕터
```
GET    /api/stories/:id/chapters                목록
POST   /api/stories/:id/chapters                생성 [AUTH, OWNER]
GET    /api/stories/:id/chapters/:chapterId     상세
PUT    /api/stories/:id/chapters/:chapterId     수정 [AUTH, OWNER]
DELETE /api/stories/:id/chapters/:chapterId     삭제 [AUTH, OWNER]
```

### 스토리 플레이
```
POST   /api/stories/:id/play-message   AI 응답 생성 [AUTH]
                                       Body: { userMessage, chapterTitle, chapterContent,
                                               playerSetup, currentStatus, turnCount }
                                       Returns: { rawReply }  ← [STORY][STATUS_UPDATE][CHOICES] 형식
```

### 플레이 세션 (DB 저장/복원)
```
GET    /api/play-sessions          내 플레이 세션 목록 (updatedAt 내림차순) [AUTH]
POST   /api/play-sessions          새 세션 생성 [AUTH]
GET    /api/play-sessions/:id      세션 상세 + 메시지 목록 [AUTH, OWNER]
PATCH  /api/play-sessions/:id      세션 업데이트 (charStatus, turnCount, messages) [AUTH, OWNER]
```

### 캐릭터
```
GET    /api/characters             목록
POST   /api/characters             생성 [AUTH]
GET    /api/characters/:id         상세
PUT    /api/characters/:id         수정 [AUTH, OWNER]
DELETE /api/characters/:id         삭제 [AUTH, OWNER]
```

### 키워드북 (캐릭터 컨텍스트 자동 삽입)
```
GET    /api/characters/:id/keywords        목록 [AUTH, OWNER]
POST   /api/characters/:id/keywords        생성 [AUTH, OWNER]
PUT    /api/characters/:id/keywords/:kwId  수정 [AUTH, OWNER]
DELETE /api/characters/:id/keywords/:kwId  삭제 [AUTH, OWNER]
```

### 캐릭터 채팅
```
GET    /api/chat/sessions                      내 세션 목록 [AUTH]
GET    /api/chat/sessions/:sessionId           세션 + 메시지 [AUTH, OWNER]
DELETE /api/chat/sessions/:sessionId           세션 삭제 [AUTH, OWNER]
GET    /api/chat/sessions/:sessionId/messages  메시지 목록 [AUTH]
POST   /api/chat/sessions/:sessionId/messages  메시지 전송 → AI 응답 [AUTH]
```

### 내 작품
```
GET    /api/users/me/stories     내 스토리 목록 [AUTH]
GET    /api/users/me/characters  내 캐릭터 목록 [AUTH]
GET    /api/users/me/bookmarks   내 북마크 목록 [AUTH]
```

### 이미지 생성
```
POST   /api/generate/image   SD WebUI 이미지 생성 [AUTH]
                              Body: { prompt, negativePrompt?, width?, height? }
```

### 관리자
```
GET    /api/admin/stats   전체 통계 (유저수·스토리수·캐릭터수·채팅수) [ADMIN]
```

---

## 6. 핵심 기능 상세

### 스토리 플레이 시스템

**플레이 흐름:**
1. 스토리 상세 페이지 → "플레이 시작" 클릭
2. `StartSettingsModal`: 세력 선택(정파/사파/마교/독립) → 캐릭터 설정(이름/성별/배경)
3. 설정 확정 → DB에 `PlaySession` 생성, URL에 `?session={id}` 추가
4. 사용자가 첫 행동 입력 → `POST /api/stories/:id/play-message` 호출
5. AI 응답 파싱: `[STORY]`, `[STATUS_UPDATE]`, `[CHOICES]` 3섹션
6. 매 턴마다 `PATCH /api/play-sessions/:id`로 메시지+상태 DB 저장

**저장 이중화:**
- `localStorage`: 즉시 저장 (오프라인/속도 우선)
- DB (`PlaySession` + `PlayMessage`): 크로스 디바이스 복원 지원

**사이드바 복원:** URL에 `?session={id}` 있으면 마운트 시 DB에서 메시지+상태 복원

**AI 응답 형식:**
```
[STORY]
2~4단락 서사 묘사
[/STORY]

[STATUS_UPDATE]
내공: +10
위치: 화산파 뒷산
[/STATUS_UPDATE]

[CHOICES]
화산파에 입문하겠다고 선언한다
몰래 훔쳐보며 무공을 익힌다
다른 세력을 찾아 떠난다
[/CHOICES]
```

**버그 수정 이력:**
- `turnCount + 1`을 API에 전달 → 첫 턴(turn=0)에서 Claude가 `[CHOICES]` 생략하는 문제 해결
- `SectionRow` default export를 named import로 잘못 참조하던 문제 수정 (`page.tsx`, `characters/page.tsx`)
- `StartSettingsModal.tsx` / `ImageGenModal.tsx` / `claude.ts` / `messages/route.ts` 중복 코드 잔존으로 인한 구문 오류 수정
- `lib/validators/chat.ts`: `validateSendMessage` 누락 추가, `UpdateSessionInput`에 `title` 필드 추가
- `parseAIResponse` 강화: Claude가 `# [TAG]` + `---` 마크다운 형식으로 응답할 때도 섹션을 정상 파싱하도록 수정; `rawStatus`를 `[STATUS_UPDATE]...[/STATUS_UPDATE]` 정규화 형식으로 반환
- 시스템 프롬프트 강화: 닫는 태그 필수 명시, 마크다운 헤더·수평선 사용 금지 규칙 추가
- `CharacterStatusPanel`: `top-0 h-full` → `top-14 bottom-0` (전역 헤더 겹침 수정); 토글 버튼 수직 중앙 헤더 높이만큼 보정
- 스토리 플레이 페이지: `fixed inset-0` → `fixed top-14 bottom-0 left-0 md:left-60` — 전역 헤더·사이드바와 겹치지 않도록 수정, 에피소드 탭 항상 표시

### 캐릭터 채팅 시스템

- Socket.IO 실시간 스트리밍 (`:3001`)
- L1~L6 프롬프트 조립 (`lib/ai/promptBuilder.ts`)
- 메모리 4요소 로드/저장 (`lib/memory.ts`)
- 키워드북: 대화 중 키워드 감지 시 컨텍스트 자동 삽입

### 사이드바 에피소드 패널

탭 전환 없이 항상 표시. 채팅 세션과 플레이 세션을 `updatedAt` 내림차순으로 합산해서 최대 15개 표시:
- **채팅 세션**: 캐릭터 아바타 + 캐릭터명 + 마지막 메시지 미리보기
- **플레이 세션**: 책 아이콘 + 스토리명 + `N턴 진행 중`

플레이 세션 생성/업데이트 직후 `swrMutate("/api/play-sessions?limit=10")` 호출로 즉시 갱신.

**레이아웃 정책 (full-screen 페이지에서 사이드바 노출):**
- 스토리 플레이 등 자체 레이아웃 페이지는 `fixed inset-0` 대신 `fixed top-14 bottom-0 left-0 md:left-60`을 사용
- `top-14`: 전역 헤더(56px) 아래 시작
- `md:left-60`: PC에서 사이드바(240px) 오른쪽에 위치해 에피소드 탭 항상 노출
- 모바일(`left-0`): 사이드바가 드로어 오버레이이므로 전체 폭 사용

---

## 7. 인증 · RBAC

### 역할 체계

| Role | 자신의 콘텐츠 | 타인 콘텐츠 | 관리자 페이지 |
|------|:---:|:---:|:---:|
| **USER** | CRUD | 읽기만 | ❌ |
| **ADMIN** | CRUD | CRUD | ✅ |

### 핵심 헬퍼 (`lib/rbac.ts`)

```typescript
requireAuth()             // 로그인 필수 — 미인증 시 401
requireAdmin()            // ADMIN 필수 — USER 시 403
requireOwnerOrAdmin(ownerId, requesterId, role)  // 소유자·관리자만
```

### API 래퍼 (`lib/api-handler.ts`)

```typescript
withHandler(handler)           // 정적 라우트 (params 불필요)
withDynamicHandler(handler)    // 동적 라우트 ([id] 등)
```

---

## 8. AI 연동

### Claude CLI (`lib/ai/claude.ts`)

```typescript
streamClaude(systemPrompt, messages)  // AsyncGenerator<string> — 스트리밍
askClaude(systemPrompt, userMessage)  // Promise<string> — 단일 응답
```

`child_process.spawn('claude', ['-p', prompt])` 방식으로 기존 로그인 세션 재사용.

### SD WebUI (`lib/ai/sdwebui.ts`)

`POST http://localhost:7860/sdapi/v1/txt2img` → base64 디코딩 → `/public/uploads/` 저장

---

## 9. 환경변수 (.env.local)

```bash
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<openssl rand -base64 32>
DATABASE_URL="file:./prisma/saga.db"
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001
SD_WEBUI_URL=http://localhost:7860
UPLOAD_DIR=./public/uploads
```

---

## 10. 개발 명령

```bash
npm run dev          # Next.js(:3000) + Socket(:3001) 동시 실행
npx prisma studio    # DB GUI(:5555)
npx prisma migrate dev --name <name>   # 스키마 변경 적용
npx vitest           # 테스트 감시 모드
npx tsc --noEmit     # TypeScript 오류 확인
```

---

## 11. 구현 현황

### 완료 ✅

**기반**
- Next.js 14 App Router + TypeScript strict + Tailwind 다크 테마
- NextAuth Credentials 로그인/회원가입 (이메일 인증 없음)
- RBAC: USER / ADMIN, requireAuth / requireAdmin / requireOwnerOrAdmin
- Prisma SQLite, api-handler 래퍼

**스토리**
- 스토리 CRUD, 챕터 CRUD
- 좋아요 / 북마크 토글
- 스토리 플레이 (인터랙티브 소설)
  - StartSettingsModal: 세력·캐릭터 설정
  - CharacterStatusPanel: 우측 STATUS 패널
  - [STORY][STATUS_UPDATE][CHOICES] 파싱
  - 분기 생성, 재생성, 자동재생(3턴)
  - localStorage + DB(PlaySession/PlayMessage) 이중 저장
  - 사이드바 최근대화 탭 통합

**캐릭터**
- 캐릭터 CRUD
- 키워드북 (Keyword 모델, 자동 컨텍스트 삽입)
- Socket.IO 실시간 채팅 스트리밍
- L1~L6 프롬프트 조립 / 메모리 4요소

**UI**
- 사이드바: 에피소드 패널(채팅+플레이 합산, 항상 표시), 탭 없음
- StoryCard / CharacterCard
- ImageGenModal (SD WebUI 연동)
- 내 작품 페이지 (스토리+캐릭터 관리)

**관리자**
- `/api/admin/stats` 통계 API

### 미구현 / 예정 🔲

- 관리자 페이지 UI (`/admin/*`)
- 홈 히어로 배너 슬라이더
- 탐색/검색 페이지
- 조회수 카운트 (debounce)
- 댓글
- 소셜 로그인 (카카오/구글)
- PostgreSQL 전환
- 모바일 최적화

---

*SAGA 개발문서 v2.2 — 2026-05-16 기준 실제 구현 현황*
