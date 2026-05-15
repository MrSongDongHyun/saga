# SAGA — AI 소설·캐릭터 채팅 플랫폼

> AI 기반 소설 창작 & 캐릭터 채팅 웹 플랫폼 | Next.js 14 + TypeScript + Prisma + Socket.IO

---

## 목차

1. [소개](#1-소개)
2. [사전 요구사항](#2-사전-요구사항)
3. [설치](#3-설치)
4. [환경 변수 설정](#4-환경-변수-설정)
5. [데이터베이스 초기화](#5-데이터베이스-초기화)
6. [개발 서버 실행](#6-개발-서버-실행)
7. [주요 기능 사용법](#7-주요-기능-사용법)
8. [에이전트 개발 워크플로우](#8-에이전트-개발-워크플로우)
9. [테스트](#9-테스트)
10. [빌드 & 프로덕션](#10-빌드--프로덕션)
11. [자주 묻는 질문](#11-자주-묻는-질문)

---

## 1. 소개

SAGA는 AI 소설 창작과 캐릭터 채팅을 결합한 웹 플랫폼입니다.

| 기능 | 설명 |
|------|------|
| 소설 창작 | 챕터 기반 소설 작성 · 공개/비공개/미등록 공개 |
| AI 캐릭터 채팅 | 직접 설계한 캐릭터와 Claude AI 기반 실시간 대화 |
| 스토리 플레이 | 소설을 채팅 형식으로 인터랙티브하게 진행 |
| 좋아요 · 북마크 | 소설 즐겨찾기 및 반응 |
| 관리자 대시보드 | 사용자 · 콘텐츠 통계 관리 |

**기술 스택 요약**

```
Frontend  : Next.js 14 (App Router) · TypeScript · Tailwind CSS · Framer Motion
Backend   : Next.js API Routes · Socket.IO (포트 3001)
Database  : SQLite (Prisma ORM) → PostgreSQL 확장 가능
Auth      : NextAuth.js v5 · Credentials(ID/PW) · RBAC(USER/ADMIN)
AI        : Claude CLI (로컬 로그인 세션)
Image     : Stable Diffusion WebUI (선택, 포트 7860)
```

---

## 2. 사전 요구사항

| 도구 | 버전 | 확인 명령 |
|------|------|-----------|
| Node.js | 18.17 이상 | `node -v` |
| npm | 9 이상 | `npm -v` |
| Claude CLI | 최신 | `claude --version` |
| Git | 2.x | `git --version` |

> **Claude CLI 로그인 필수**: AI 채팅 기능은 로컬에 설치된 Claude CLI의 세션을 재사용합니다.  
> 설치 후 `claude` 명령으로 한 번 로그인하세요.

**선택 사항**

| 도구 | 용도 |
|------|------|
| Stable Diffusion WebUI | 캐릭터 이미지 생성 (포트 7860) |
| Docker | PostgreSQL / Redis 컨테이너 실행 |

---

## 3. 설치

```bash
# 저장소 클론
git clone <repo-url> saga
cd saga

# 의존성 설치
npm install
```

---

## 4. 환경 변수 설정

프로젝트 루트에 `.env`와 `.env.local` 두 파일이 필요합니다.

### .env (Prisma CLI용)

```env
DATABASE_URL="file:./prisma/saga.db"
SEED_ADMIN_PASSWORD="ChangeMe!2026"
```

### .env.local (Next.js 런타임용)

```env
# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=여기에-32자-이상의-랜덤-문자열-입력

# 데이터베이스
DATABASE_URL="file:./prisma/saga.db"

# Socket.IO
NEXT_PUBLIC_SOCKET_URL=http://localhost:3001

# Stable Diffusion (선택)
SD_WEBUI_URL=http://localhost:7860
```

> `NEXTAUTH_SECRET` 생성 방법:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

## 5. 데이터베이스 초기화

```bash
# 스키마 적용 (첫 설치 또는 스키마 변경 시)
npm run db:push

# 시드 데이터 생성 (관리자 계정 + 샘플 데이터)
npm run db:seed
```

시드 실행 후 생성되는 기본 계정:

| 역할 | 로그인 ID | 비밀번호 |
|------|-----------|---------|
| 관리자 | `admin` | `.env`의 `SEED_ADMIN_PASSWORD` 값 |
| 일반 사용자 | `user1` | `user1pass` |

> 프로덕션 배포 전 반드시 비밀번호를 변경하세요.

**DB 관리 GUI (선택)**

```bash
npm run db:studio   # http://localhost:5555 에서 Prisma Studio 실행
```

---

## 6. 개발 서버 실행

```bash
# Next.js(:3000) + Socket.IO(:3001) 동시 실행
npm run dev
```

| 서비스 | URL |
|--------|-----|
| 웹 앱 | http://localhost:3000 |
| Socket.IO | http://localhost:3001 |
| Prisma Studio | http://localhost:5555 (별도 `npm run db:studio`) |

개별 실행이 필요한 경우:

```bash
npm run dev:next    # Next.js만 실행
npm run dev:socket  # Socket.IO만 실행
```

---

## 7. 주요 기능 사용법

### 7-1. 회원가입 & 로그인

1. http://localhost:3000/register 접속
2. 로그인 ID · 비밀번호 · 닉네임 입력 후 가입
3. http://localhost:3000/login 에서 로그인

### 7-2. 소설(스토리) 작성

1. 상단 네비게이션 → **내 작품** 탭
2. **새 소설 작성** 버튼 클릭
3. 제목 · 설명 · 장르 · 태그 입력 후 저장
4. 챕터 추가: 소설 상세 → **챕터 추가**
5. 공개 설정: `공개` / `비공개` / `미등록 공개` 선택

### 7-3. AI 캐릭터 생성

1. **캐릭터** 탭 → **새 캐릭터 만들기**
2. 이름 · 성격 · 배경 스토리 · 첫 인사말 입력
3. 태그 및 공개 여부 설정 후 저장

> Claude CLI가 로컬에서 실행 중이어야 캐릭터와 대화할 수 있습니다.

### 7-4. 캐릭터 채팅

1. 캐릭터 카드 → **채팅 시작**
2. 새 세션 생성 후 메시지 입력
3. AI가 캐릭터 페르소나로 응답 (실시간 스트리밍)

### 7-5. 스토리 플레이

1. 소설 상세 페이지 → **플레이** 버튼
2. 챕터 내용을 채팅 형식으로 진행
3. 독자가 직접 선택지를 입력해 이야기 진행

### 7-6. 관리자 기능

관리자 계정으로 로그인 시 추가 메뉴 노출:

- 전체 사용자 목록 조회
- 콘텐츠 통계 (`GET /api/admin/stats`)
- 비공개 콘텐츠 관리

---

## 8. 에이전트 개발 워크플로우

SAGA 개발은 Claude Code의 슬래시 커맨드로 에이전트를 호출해 진행합니다.

```
새 기능 추가 표준 흐름:

/plan [기능명]   →  기획 에이전트: API 설계 · DB 스키마 설계
/dev [구현내용]  →  개발 에이전트: 컴포넌트 · API Route 코드 작성
/test [대상]     →  TDD 에이전트: Vitest 테스트 작성 · 검증
/review          →  리뷰 에이전트: 보안 · 품질 · 성능 점검
```

**예시: 댓글 기능 추가**

```bash
/plan 소설 댓글 기능
/dev 댓글 API Route 및 컴포넌트
/test 댓글 API
/review
```

각 에이전트는 CLAUDE.md의 코드 규칙(TypeScript strict, 인증 필수, Prisma ORM만 사용)을 자동으로 따릅니다.

---

## 9. 테스트

```bash
# 테스트 1회 실행
npm test

# 파일 변경 감지 · 자동 재실행
npm run test:watch

# 커버리지 리포트 생성
npx vitest run --coverage
```

테스트 파일 위치: `__tests__/`

---

## 10. 빌드 & 프로덕션

```bash
# 프로덕션 빌드
npm run build

# 빌드된 앱 실행
npm start
```

**프로덕션 체크리스트**

```
□ NEXTAUTH_SECRET을 안전한 랜덤 값으로 교체
□ SEED_ADMIN_PASSWORD 변경 후 시드 재실행
□ DATABASE_URL을 PostgreSQL URL로 교체 (선택)
□ SD_WEBUI_URL 설정 (이미지 생성 사용 시)
□ NEXTAUTH_URL을 실제 도메인으로 변경
```

**PostgreSQL로 마이그레이션 (선택)**

```bash
# 1. .env의 DATABASE_URL 변경
DATABASE_URL="postgresql://user:password@localhost:5432/sagadb"

# 2. 스키마 재적용
npm run db:push

# 3. 시드 재실행
npm run db:seed
```

---

## 11. 자주 묻는 질문

**Q. AI 채팅이 작동하지 않아요.**
- `claude --version`으로 Claude CLI 설치 여부 확인
- `claude` 명령 실행 후 로그인 세션 유지 여부 확인

**Q. Socket.IO 연결 오류가 납니다.**
- `npm run dev:socket`이 실행 중인지 확인
- `.env.local`의 `NEXT_PUBLIC_SOCKET_URL`이 `http://localhost:3001`인지 확인

**Q. Prisma 마이그레이션 오류가 납니다.**
- `npm run db:push`를 다시 실행
- `prisma/saga.db` 파일을 삭제 후 `npm run db:push && npm run db:seed` 재실행

**Q. 관리자 페이지에 접근이 안 됩니다.**
- 시드로 생성된 `admin` 계정으로 로그인했는지 확인
- `User.role`이 `ADMIN`인지 Prisma Studio에서 확인

---

## 라이선스

개인 프로젝트 · 비공개 운용 기준
