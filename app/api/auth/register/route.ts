// 회원가입 API
// POST /api/auth/register
// 인증 불필요 (공개 엔드포인트)
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withHandler } from "@/lib/api-handler";

/** 아이디 형식: 영문+숫자 4~20자 */
const LOGIN_ID_REGEX = /^[a-zA-Z0-9]{4,20}$/;

export const POST = withHandler(async (req: NextRequest) => {
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

  // 타입 가드 — body가 객체인지 확인
  if (typeof body !== "object" || body === null) {
    return NextResponse.json(
      { error: "잘못된 요청 형식입니다." },
      { status: 400 }
    );
  }

  const { loginId, password, nickname } = body as Record<string, unknown>;

  // ── 1. loginId 검증 ──────────────────────────────
  if (typeof loginId !== "string" || !LOGIN_ID_REGEX.test(loginId)) {
    return NextResponse.json(
      {
        error: "아이디는 영문과 숫자만 사용 가능하며 4~20자여야 합니다.",
        field: "loginId",
      },
      { status: 400 }
    );
  }

  // ── 2. password 검증 ─────────────────────────────
  if (typeof password !== "string" || password.length < 6) {
    return NextResponse.json(
      {
        error: "비밀번호는 6자 이상이어야 합니다.",
        field: "password",
      },
      { status: 400 }
    );
  }

  // ── 3. nickname 검증 ─────────────────────────────
  if (
    typeof nickname !== "string" ||
    nickname.length < 2 ||
    nickname.length > 15
  ) {
    return NextResponse.json(
      {
        error: "닉네임은 2~15자여야 합니다.",
        field: "nickname",
      },
      { status: 400 }
    );
  }

  // ── 4. 중복 체크 (loginId, nickname 각각 별도 쿼리) ──
  // UX 우선: 어느 필드가 중복인지 구체적으로 안내
  const existingLoginId = await prisma.user.findUnique({
    where: { loginId },
    select: { id: true },
  });

  if (existingLoginId) {
    return NextResponse.json(
      {
        error: "이미 사용 중인 아이디입니다.",
        field: "loginId",
      },
      { status: 400 }
    );
  }

  const existingNickname = await prisma.user.findUnique({
    where: { nickname },
    select: { id: true },
  });

  if (existingNickname) {
    return NextResponse.json(
      {
        error: "이미 사용 중인 닉네임입니다.",
        field: "nickname",
      },
      { status: 400 }
    );
  }

  // ── 5. 비밀번호 해시 ─────────────────────────────
  const hashedPassword = await bcrypt.hash(password, 10);

  // ── 6. 사용자 생성 ───────────────────────────────
  // 사전 중복 체크(4단계)와 create 사이에 race condition이 발생할 수 있으므로
  // Prisma P2002(unique constraint 위반)를 최후 방어선으로 캐치하여 400 반환
  try {
    const newUser = await prisma.user.create({
      data: {
        loginId,
        password: hashedPassword,
        nickname,
        role: "USER", // 일반 회원가입은 항상 USER
      },
      select: { id: true },
    });

    return NextResponse.json({ id: newUser.id }, { status: 201 });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      // race condition으로 unique 제약 위반 — 어느 필드인지 특정 불가하므로 통합 메시지
      return NextResponse.json(
        { error: "이미 사용 중인 아이디 또는 닉네임입니다." },
        { status: 400 }
      );
    }
    // 그 외 예기치 않은 DB 오류는 withHandler가 500으로 처리
    throw err;
  }
});
