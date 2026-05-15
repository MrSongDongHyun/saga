---
name: project-saga
description: SAGA 프로젝트 개요 — AI 소설·캐릭터 채팅 웹앱, Next.js 14 + Prisma + Claude CLI 스택
metadata:
  type: project
---

SAGA는 AI 소설·캐릭터 채팅 웹앱 프로젝트다. Claude Code 에이전트 구성(CLAUDE.md + 슬래시 커맨드 4종)이 2026-05-15에 초기 세팅됐다.

**Why:** 기획→개발→테스트→리뷰의 4단계 멀티 에이전트 워크플로우를 Claude Code 슬래시 커맨드로 표준화하기 위함.

**How to apply:** 새 기능 요청 시 /plan → /dev → /test → /review 순서를 권장. 단일 단계 요청은 해당 커맨드만 직접 사용.

핵심 스택:
- Next.js 14 App Router + TypeScript strict
- Prisma ORM + SQLite (추후 PostgreSQL)
- NextAuth.js v5 (Credentials, RBAC: USER/ADMIN)
- Claude CLI via child_process.spawn
- Socket.IO (:3001) 실시간 채팅
- Stable Diffusion WebUI (:7860) 이미지

핵심 lib 파일: lib/auth.ts, lib/rbac.ts, lib/ai/claude.ts, lib/ai/promptBuilder.ts, lib/memory.ts
