# SAGA 시스템 아키텍처

> 최종 수정: 2026-05-15

---

## 목차

1. [전체 아키텍처 개요](#1-전체-아키텍처-개요)
2. [레이어 구조](#2-레이어-구조)
3. [디렉토리 구조](#3-디렉토리-구조)
4. [데이터 모델 (ERD)](#4-데이터-모델-erd)
5. [API 설계](#5-api-설계)
6. [인증 & 인가 흐름](#6-인증--인가-흐름)
7. [AI 채팅 파이프라인](#7-ai-채팅-파이프라인)
8. [실시간 통신 (Socket.IO)](#8-실시간-통신-socketio)
9. [프론트엔드 구조](#9-프론트엔드-구조)
10. [에이전트 개발 아키텍처](#10-에이전트-개발-아키텍처)
11. [확장 로드맵](#11-확장-로드맵)

---

## 1. 전체 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────┐
│                        개인 PC (로컬호스트)                        │
│                                                                 │
│  ┌──────────────────┐    HTTP/WS    ┌──────────────────────┐   │
│  │   브라우저 클라이언트  │◄────────────►│  Next.js App (:3000)  │   │
│  │                  │              │  - App Router (SSR)   │   │
│  │  - React 18      │              │  - API Routes         │   │
│  │  - Tailwind CSS  │              │  - NextAuth.js v5     │   │
│  │  - SWR / Zustand │              └──────────┬───────────┘   │
│  │  - Socket.IO CLI │                         │ Prisma ORM     │
│  └────────┬─────────┘              ┌──────────▼───────────┐   │
│           │                        │  SQLite DB            │   │
│           │ Socket.IO              │  (prisma/saga.db)     │   │
│           │ (:3001)                └──────────────────────┘   │
│           │                                                     │
│  ┌────────▼─────────┐              ┌──────────────────────┐   │
│  │  Socket.IO 서버   │              │  Claude CLI           │   │
│  │  (:3001)         │◄────────────►│  (child_process)      │   │
│  │  - 채팅 스트리밍  │   spawn/pipe  │  - AI 응답 생성       │   │
│  │  - 실시간 알림    │              └──────────────────────┘   │
│  └──────────────────┘                                           │
│                                                                 │
│  ┌──────────────────┐  선택 사항                                 │
│  │  Stable Diffusion│                                           │
│  │  WebUI (:7860)   │  캐릭터 이미지 자동 생성                    │
│  └──────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 레이어 구조

```
┌─────────────────────────────────────────┐
│           Presentation Layer            │
│  app/(main)/  app/(auth)/  components/  │
│  React 컴포넌트 · 페이지 · 레이아웃        │
├─────────────────────────────────────────┤
│            API Layer                    │
│         app/api/**  (REST)              │
│  요청 검증 · 인증 · 비즈니스 로직 조율     │
├─────────────────────────────────────────┤
│           Service Layer                 │
│       lib/  (유틸리티 & 핵심 로직)         │
│  auth.ts · rbac.ts · ai/ · memory.ts   │
├─────────────────────────────────────────┤
│           Data Layer                    │
│     Prisma ORM + SQLite/PostgreSQL      │
│  lib/prisma.ts (싱글톤 PrismaClient)     │
└─────────────────────────────────────────┘
```

---

## 3. 디렉토리 구조

```
saga/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # 인증 페이지 그룹 (레이아웃 분리)
│   │   ├── login/page.tsx
│   │   └── register/page.tsx
│   ├── (main)/                   # 메인 페이지 그룹
│   │   ├── layout.tsx            # 헤더 + 사이드바 레이아웃
│   │   ├── page.tsx              # 홈 (스토리 피드)
│   │   ├── characters/           # 캐릭터 목록 · 상세
│   │   ├── stories/[id]/         # 스토리 상세
│   │   ├── story/[id]/play/      # 스토리 플레이 (채팅형)
│   │   ├── chat/[sessionId]/     # 캐릭터 채팅
│   │   └── my/                   # 내 작품 · 캐릭터 관리
│   ├── api/                      # REST API Routes
│   │   ├── auth/                 # NextAuth + 회원가입
│   │   ├── stories/              # 소설 CRUD + 좋아요/북마크
│   │   ├── characters/           # 캐릭터 CRUD
│   │   ├── chat/                 # 채팅 세션 · 메시지
│   │   ├── users/me/             # 내 프로필 · 콘텐츠
│   │   └── admin/                # 관리자 API
│   └── layout.tsx                # 루트 레이아웃 (SessionProvider)
│
├── components/                   # 재사용 컴포넌트
│   ├── providers/SessionProvider.tsx
│   ├── layout/
│   │   ├── Header.tsx
│   │   └── Sidebar.tsx
│   ├── ui/
│   │   ├── StoryCard.tsx
│   │   ├── CharacterCard.tsx
│   │   ├── SectionRow.tsx
│   │   ├── NumberBadge.tsx
│   │   └── MyItemRow.tsx
│   └── chat/
│       ├── MessageBubble.tsx
│       ├── TypingIndicator.tsx
│       └── MessageInput.tsx
│
├── lib/                          # 핵심 유틸리티
│   ├── prisma.ts                 # PrismaClient 싱글톤
│   ├── auth.ts                   # NextAuth 설정
│   ├── rbac.ts                   # requireAuth / requireAdmin / requireOwnerOrAdmin
│   ├── api-handler.ts            # API 공통 응답 헬퍼
│   ├── memory.ts                 # AI 컨텍스트 메모리 관리
│   └── ai/
│       ├── claude.ts             # streamClaude / askClaude
│       └── promptBuilder.ts      # L1~L6 프롬프트 조립
│
├── socket-server/
│   └── index.ts                  # Socket.IO 서버 (포트 3001)
│
├── prisma/
│   ├── schema.prisma             # DB 스키마
│   ├── seed.ts                   # 초기 데이터
│   └── saga.db                   # SQLite 파일 (gitignore)
│
├── types/
│   └── next-auth.d.ts            # NextAuth 세션 타입 확장
│
├── __tests__/                    # Vitest 테스트 파일
├── Doc/                          # 프로젝트 문서
├── .env                          # Prisma CLI용 환경변수
├── .env.local                    # Next.js 런타임 환경변수
├── CLAUDE.md                     # 에이전트 가이드
└── README.md                     # 설치 & 사용법
```

---

## 4. 데이터 모델 (ERD)

```
┌─────────────┐         ┌─────────────────┐
│    User     │         │      Story      │
├─────────────┤   1:N   ├─────────────────┤
│ id (PK)     │────────►│ id (PK)         │
│ loginId     │         │ authorId (FK)   │
│ password    │         │ title           │
│ nickname    │         │ description     │
│ role        │         │ genre (JSON)    │
│ profileImage│         │ tags (JSON)     │
│ bio         │         │ status          │
│ createdAt   │         │ visibility      │
└──────┬──────┘         │ viewCount       │
       │                └────────┬────────┘
       │ 1:N                     │ 1:N
       │                         ▼
       │                ┌─────────────────┐
       │                │    Chapter      │
       │                ├─────────────────┤
       │                │ id (PK)         │
       │                │ storyId (FK)    │
       │                │ title           │
       │                │ content         │
       │                │ orderIndex      │
       │                │ isPublished     │
       │                └─────────────────┘
       │
       │ N:M (via Like)  ┌─────────────────┐
       ├────────────────►│      Like       │
       │                 ├─────────────────┤
       │                 │ id (PK)         │
       │                 │ userId (FK)     │  unique(userId, storyId)
       │                 │ storyId (FK)    │
       │                 └─────────────────┘
       │
       │ N:M (via Bookmark)
       ├────────────────►┌─────────────────┐
       │                 │    Bookmark     │
       │                 ├─────────────────┤
       │                 │ id (PK)         │
       │                 │ userId (FK)     │  unique(userId, storyId)
       │                 │ storyId (FK)    │
       │                 └─────────────────┘
       │
       │ 1:N            ┌─────────────────┐
       └───────────────►│   Character     │
                        ├─────────────────┤
                        │ id (PK)         │
                        │ creatorId (FK)  │
                        │ name            │
                        │ description     │
                        │ personality     │
                        │ backgroundStory │
                        │ firstMessage    │
                        │ avatar          │
                        │ tags (JSON)     │
                        │ visibility      │
                        └────────┬────────┘
                                 │ 1:N
                                 ▼
                        ┌─────────────────┐       ┌─────────────────┐
                        │  ChatSession    │ 1:N   │    Message      │
                        ├─────────────────┤──────►├─────────────────┤
                        │ id (PK)         │       │ id (PK)         │
                        │ userId (FK)     │       │ sessionId (FK)  │
                        │ characterId (FK)│       │ role            │
                        │ title           │       │ content         │
                        │ createdAt       │       │ createdAt       │
                        └─────────────────┘       └─────────────────┘
```

**RBAC 역할 정의**

| Role | 권한 |
|------|------|
| `USER` | 본인 스토리/캐릭터 CRUD · 채팅 · 좋아요/북마크 |
| `ADMIN` | USER 전체 권한 + 타인 콘텐츠 관리 + 통계 조회 |

---

## 5. API 설계

### 인증

| Method | Path | 설명 | 인가 |
|--------|------|------|------|
| POST | `/api/auth/register` | 회원가입 | 없음 |
| POST | `/api/auth/[...nextauth]` | 로그인/로그아웃 | NextAuth |

### 스토리

| Method | Path | 설명 | 인가 |
|--------|------|------|------|
| GET | `/api/stories` | 공개 스토리 목록 | 없음 |
| POST | `/api/stories` | 스토리 생성 | USER |
| GET | `/api/stories/[id]` | 스토리 상세 | 조건부 |
| PUT | `/api/stories/[id]` | 스토리 수정 | OWNER/ADMIN |
| DELETE | `/api/stories/[id]` | 스토리 삭제 | OWNER/ADMIN |
| POST | `/api/stories/[id]/like` | 좋아요 토글 | USER |
| POST | `/api/stories/[id]/bookmark` | 북마크 토글 | USER |

### 챕터

| Method | Path | 설명 | 인가 |
|--------|------|------|------|
| GET | `/api/stories/[id]/chapters` | 챕터 목록 | 조건부 |
| POST | `/api/stories/[id]/chapters` | 챕터 생성 | OWNER/ADMIN |
| GET | `/api/stories/[id]/chapters/[chapterId]` | 챕터 상세 | 조건부 |
| PUT | `/api/stories/[id]/chapters/[chapterId]` | 챕터 수정 | OWNER/ADMIN |

### 캐릭터

| Method | Path | 설명 | 인가 |
|--------|------|------|------|
| GET | `/api/characters` | 공개 캐릭터 목록 | 없음 |
| POST | `/api/characters` | 캐릭터 생성 | USER |
| GET | `/api/characters/[id]` | 캐릭터 상세 | 조건부 |
| PUT | `/api/characters/[id]` | 캐릭터 수정 | OWNER/ADMIN |
| DELETE | `/api/characters/[id]` | 캐릭터 삭제 | OWNER/ADMIN |

### 채팅

| Method | Path | 설명 | 인가 |
|--------|------|------|------|
| POST | `/api/chat/sessions` | 세션 생성 | USER |
| GET | `/api/chat/sessions/[sessionId]` | 세션 조회 | OWNER |
| DELETE | `/api/chat/sessions/[sessionId]` | 세션 삭제 | OWNER |
| GET | `/api/chat/sessions/[sessionId]/messages` | 메시지 목록 | OWNER |

### 사용자

| Method | Path | 설명 | 인가 |
|--------|------|------|------|
| GET | `/api/users/me/stories` | 내 스토리 | USER |
| GET | `/api/users/me/characters` | 내 캐릭터 | USER |
| GET | `/api/users/me/bookmarks` | 내 북마크 | USER |

### 관리자

| Method | Path | 설명 | 인가 |
|--------|------|------|------|
| GET | `/api/admin/stats` | 통계 | ADMIN |

---

## 6. 인증 & 인가 흐름

```
로그인 요청
    │
    ▼
NextAuth Credentials Provider
    │  ID/PW 검증 (bcrypt)
    ▼
JWT 세션 토큰 발급 (NEXTAUTH_SECRET으로 서명)
    │
    ▼
쿠키에 세션 저장 (httpOnly, secure)
    │
    ▼
API 요청 시:

  requireAuth()          → 로그인 여부만 확인
  requireAdmin()         → ADMIN 역할 확인
  requireOwnerOrAdmin()  → 리소스 소유자 또는 ADMIN 확인
       │
       │ 실패 시
       ▼
  401 Unauthorized / 403 Forbidden 반환
```

**RBAC 미들웨어 (lib/rbac.ts)**

```typescript
// 사용 예시
export async function GET(req: Request) {
  const session = await requireAuth()      // 미인증 시 401
  // ...
}

export async function DELETE(req: Request, { params }) {
  const session = await requireOwnerOrAdmin(params.id, 'story')
  // ...
}
```

---

## 7. AI 채팅 파이프라인

```
사용자 메시지 입력
        │
        ▼
  Socket.IO 이벤트 emit
  ('chat:message', { sessionId, content })
        │
        ▼
  Socket.IO 서버 (socket-server/index.ts)
        │
        ▼
  lib/memory.ts
  메모리 4요소 로드:
  ┌──────────────────────────────┐
  │ 1. 캐릭터 페르소나             │
  │ 2. 대화 이력 (최근 N턴)        │
  │ 3. 사용자 관계 기록            │
  │ 4. 월드/스토리 컨텍스트        │
  └──────────────────────────────┘
        │
        ▼
  lib/ai/promptBuilder.ts
  L1~L6 프롬프트 조립:
  ┌──────────────────────────────┐
  │ L1: 시스템 (캐릭터 기본 설정) │
  │ L2: 세계관 / 배경              │
  │ L3: 관계 컨텍스트              │
  │ L4: 대화 이력                  │
  │ L5: 현재 메시지                │
  │ L6: 응답 지침                  │
  └──────────────────────────────┘
        │
        ▼
  lib/ai/claude.ts
  child_process.spawn('claude', [...])
  Claude CLI 호출 (로컬 세션 재사용)
        │
        │ stdout 스트림
        ▼
  Socket.IO emit('chat:stream', chunk)
  → 클라이언트에 청크 단위 전송
        │
        ▼
  스트림 종료 시 DB 저장
  (Message 레코드 생성)
        │
        ▼
  클라이언트 UI 업데이트
```

---

## 8. 실시간 통신 (Socket.IO)

```
클라이언트 (:3000)          Socket.IO 서버 (:3001)
      │                              │
      │── connect ──────────────────►│
      │                              │
      │── chat:message ─────────────►│ 메시지 수신
      │                              │   │
      │                              │   └─► Claude CLI 호출
      │                              │
      │◄── chat:stream (chunk) ──────│ 응답 청크 스트리밍
      │◄── chat:stream (chunk) ──────│
      │◄── chat:stream (chunk) ──────│
      │◄── chat:done ───────────────│ 완료 신호
      │                              │
      │── disconnect ───────────────►│
```

**이벤트 목록**

| 이벤트 | 방향 | 설명 |
|--------|------|------|
| `chat:message` | Client → Server | 사용자 메시지 전송 |
| `chat:stream` | Server → Client | AI 응답 청크 스트리밍 |
| `chat:done` | Server → Client | 스트리밍 완료 |
| `chat:error` | Server → Client | 오류 발생 |
| `typing:start` | Server → Client | AI 타이핑 시작 표시 |
| `typing:stop` | Server → Client | AI 타이핑 종료 |

---

## 9. 프론트엔드 구조

### 페이지 라우팅

```
/                          홈 (공개 스토리 피드)
├── /login                 로그인
├── /register              회원가입
├── /characters            캐릭터 목록
│   └── /[id]              캐릭터 상세
├── /stories/[id]          스토리 상세
├── /story/[id]/play       스토리 플레이 (채팅형)
├── /chat/[sessionId]      캐릭터 채팅
└── /my                    내 콘텐츠 관리
    ├── /stories/new       소설 작성
    ├── /stories/[id]/edit 소설 수정
    ├── /characters/new    캐릭터 생성
    └── /characters/[id]/edit 캐릭터 수정
```

### 상태 관리 전략

| 상태 유형 | 도구 | 용도 |
|-----------|------|------|
| 서버 데이터 | SWR | API 데이터 캐싱 · 재검증 |
| 클라이언트 상태 | Zustand | UI 상태 · 채팅 스트림 버퍼 |
| 세션 | NextAuth | 인증 상태 |
| 폼 | React 로컬 state | 입력 폼 |

### 컴포넌트 계층

```
app/(main)/layout.tsx
    ├── Header
    │   ├── 네비게이션 링크
    │   └── 사용자 프로필 드롭다운
    ├── Sidebar
    │   └── 메뉴 항목
    └── {children}  (각 페이지)
        ├── SectionRow
        │   └── StoryCard / CharacterCard
        └── (채팅 페이지)
            ├── MessageBubble
            ├── TypingIndicator
            └── MessageInput
```

---

## 10. 에이전트 개발 아키텍처

SAGA 개발은 Claude Code의 멀티 에이전트 구조로 진행됩니다.

```
사용자 요청
    │
    ▼
총괄 에이전트 (saga-director)
    │  요청 유형 분석 및 에이전트 위임
    ▼
┌───────────┬───────────┬───────────┬───────────┐
│  기획     │  개발     │  TDD      │  리뷰     │
│  에이전트 │  에이전트 │  에이전트 │  에이전트 │
│  /plan    │  /dev     │  /test    │  /review  │
├───────────┼───────────┼───────────┼───────────┤
│ API 설계  │ 컴포넌트  │ Vitest    │ 보안 검토 │
│ DB 스키마 │ API Route │ 테스트    │ 품질 점검 │
│ 기능 명세 │ 유틸 코드 │ 엣지케이스│ 성능 분석 │
└───────────┴───────────┴───────────┴───────────┘
```

**에이전트 설정 파일**

```
.claude/
├── commands/
│   ├── plan.md       # /plan 슬래시 커맨드
│   ├── dev.md        # /dev 슬래시 커맨드
│   ├── test.md       # /test 슬래시 커맨드
│   ├── review.md     # /review 슬래시 커맨드
│   └── saga.md       # /saga 총괄 커맨드
└── agents/
    ├── saga-director.md
    ├── plan.md
    ├── dev.md
    ├── test.md
    └── review.md
```

---

## 11. 확장 로드맵

### 단기 (현재 → SQLite 5만 건)

```
현재 스택
Next.js + SQLite + Claude CLI
```

### 중기 (데이터 증가 시)

```
PostgreSQL 전환
- prisma/schema.prisma datasource 1줄 변경
- npm run db:push 재실행

Redis 추가 (선택)
- 세션 캐싱
- 실시간 이벤트 큐
```

### 장기 (트래픽 증가 시)

```
현재                    →   확장
─────────────────────────────────────────────
SQLite                  →   PostgreSQL (Docker/RDS)
로컬 Claude CLI         →   Anthropic API (유료)
로컬 SD WebUI           →   외부 이미지 생성 API
단일 서버               →   Vercel/Railway 배포
Socket.IO 단일 프로세스  →   Redis Pub/Sub 멀티 인스턴스
```

**PostgreSQL 전환 단계**

```bash
# 1. Docker로 PostgreSQL 실행
docker run -d --name saga-db \
  -e POSTGRES_PASSWORD=saga1234 \
  -e POSTGRES_DB=sagadb \
  -p 5432:5432 postgres:16-alpine

# 2. .env 업데이트
DATABASE_URL="postgresql://postgres:saga1234@localhost:5432/sagadb"

# 3. 스키마 마이그레이션
npm run db:push
npm run db:seed
```

---

*이 문서는 SAGA 프로젝트의 현재 구현 상태를 기준으로 작성되었습니다.*  
*변경 시 이 파일을 함께 업데이트하세요.*
