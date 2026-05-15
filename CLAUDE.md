# SAGA 프로젝트 총괄 에이전트

## 프로젝트 컨텍스트
- 플랫폼: AI 소설·캐릭터 채팅 웹앱 (SAGA)
- 기술 스택: Next.js 14 (App Router) + TypeScript + Tailwind + Prisma + SQLite
- 인증: NextAuth.js (ID/PW Credentials, RBAC: USER / ADMIN)
- AI: Claude CLI (child_process.spawn, 기존 로그인 세션)
- 실시간: Socket.IO (:3001)
- 참고 문서: SAGA_개발에이전트.md

## 작업 분류 기준
요청이 들어오면 아래 기준으로 에이전트를 선택한다.

| 요청 유형 | 담당 에이전트 |
|-----------|--------------|
| 기능 설계·API 설계·DB 스키마 | 기획 에이전트 (/plan) |
| 컴포넌트·API Route·유틸 코드 작성 | 개발 에이전트 (/dev) |
| 테스트 코드 작성·검증 | TDD 에이전트 (/test) |
| 작성된 코드 품질·보안 점검 | 리뷰 에이전트 (/review) |
| 2개 이상 단계가 필요한 복합 작업 | 순서대로 각 에이전트 호출 |

## 복합 작업 표준 흐름
새 기능 추가 시:
1. 기획 에이전트 → 설계 확정
2. 개발 에이전트 → 코드 작성
3. TDD 에이전트  → 테스트 작성·검증
4. 리뷰 에이전트 → 최종 점검

## 스택 요약
- Frontend: Next.js 14 App Router, TypeScript, Tailwind CSS
- Backend: Next.js API Routes + Socket.IO(:3001)
- DB: SQLite (Prisma) → 추후 PostgreSQL
- Auth: NextAuth.js v5, Credentials (ID/PW), RBAC
- AI: Claude CLI child_process.spawn (기존 로그인 세션)
- 이미지: Stable Diffusion WebUI(:7860)

## 핵심 파일
- lib/auth.ts              NextAuth 설정
- lib/rbac.ts             requireAuth / requireAdmin / requireOwnerOrAdmin
- lib/ai/claude.ts        streamClaude / askClaude
- lib/ai/promptBuilder.ts L1~L6 프롬프트 조립
- lib/memory.ts           메모리 4요소 로드/저장
- prisma/schema.prisma    DB 스키마

## 코드 규칙 (항상 적용)
- 언어: TypeScript 엄격 모드 (`strict: true`)
- 파일 인코딩: UTF-8
- 들여쓰기: 스페이스 2칸
- 컴포넌트: 함수형 + named export
- API Route: `app/api/` 아래 REST 설계
- DB: Prisma ORM만 사용 (raw SQL 금지)
- 인증: 모든 보호 API에 `requireAuth()` 또는 `requireAdmin()` 적용

## 금지 사항
- any 타입 사용 금지
- raw SQL 사용 금지 (Prisma만)
- 인증 없는 데이터 변경 API 금지
- 한국어 주석 권장

## 개발 서버 실행
npm run dev          # Next.js(:3000) + Socket(:3001) 동시 실행
npx prisma studio    # DB GUI(:5555)
npx vitest           # 테스트 감시 모드

## 에이전트 슬래시 커맨드
- /plan [기능명] — 기획 에이전트: 설계 문서 작성
- /dev [구현내용] — 개발 에이전트: 코드 작성
- /test [대상]   — TDD 에이전트: 테스트 코드 작성
- /review        — 리뷰 에이전트: 변경 파일 점검
