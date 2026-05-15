// 캐릭터 상세 조회 / 수정 / 삭제 API
// GET    /api/characters/[id]  — 상세 조회
// PUT    /api/characters/[id]  — 수정 (소유자 또는 ADMIN)
// DELETE /api/characters/[id]  — 삭제 (소유자 또는 ADMIN)
import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { requireAuth, requireOwnerOrAdmin } from "@/lib/rbac";
import { validateCharacterUpdate } from "@/lib/validators/character";
import { withDynamicHandler } from "@/lib/api-handler";
import {
  serializeCharacterDetail,
  characterDetailInclude,
  CharacterWithFullRelations,
} from "@/lib/serializers/character";

// ─────────────────────────────────────────────
// 공통: 캐릭터 상세 조회
// ─────────────────────────────────────────────
async function fetchCharacterDetail(
  id: string
): Promise<CharacterWithFullRelations | null> {
  return prisma.character.findUnique({
    where: { id },
    include: characterDetailInclude,
  }) as Promise<CharacterWithFullRelations | null>;
}

// ─────────────────────────────────────────────
// GET /api/characters/[id]
// ─────────────────────────────────────────────
export const GET = withDynamicHandler(async (req, context) => {
  const { id } = await context.params;

  // 현재 로그인 사용자 조회 (인증 실패해도 공개/미등재 캐릭터는 허용)
  const session = await auth();
  const currentUserId = session?.user?.id ?? null;
  const currentUserRole = session?.user?.role ?? "USER";

  const character = await fetchCharacterDetail(id);

  // 캐릭터 없음
  if (!character) {
    return NextResponse.json(
      { error: "캐릭터를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // PRIVATE 캐릭터: 소유자 또는 ADMIN만 접근 허용
  // 타인이 접근하면 404 반환 (존재 노출 방지)
  if (character.visibility === "PRIVATE") {
    const isOwner = currentUserId === character.creatorId;
    const isAdmin = currentUserRole === "ADMIN";

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "캐릭터를 찾을 수 없습니다." },
        { status: 404 }
      );
    }
  }

  return NextResponse.json(serializeCharacterDetail(character));
});

// ─────────────────────────────────────────────
// PUT /api/characters/[id]
// ─────────────────────────────────────────────
export const PUT = withDynamicHandler(async (req, context) => {
  const { id } = await context.params;

  // 인증 필수
  const user = await requireAuth();

  // 대상 캐릭터 존재 여부 + 소유자 확인
  const existing = await prisma.character.findUnique({
    where: { id },
    select: { id: true, creatorId: true },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "캐릭터를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 소유자 또는 ADMIN만 수정 허용
  requireOwnerOrAdmin(existing.creatorId, user.id, user.role);

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

  // 유효성 검증 (실패 시 400 NextResponse throw)
  const input = validateCharacterUpdate(body);

  // Prisma 업데이트 데이터 동적 구성 (존재하는 필드만)
  const updateData: Prisma.CharacterUpdateInput = {};

  if (input.name !== undefined) {
    updateData.name = input.name;
  }
  if ("description" in input) {
    // null이면 DB null로 저장 (삭제), 문자열이면 업데이트
    updateData.description = input.description ?? null;
  }
  if ("personality" in input) {
    updateData.personality = input.personality ?? null;
  }
  if ("backgroundStory" in input) {
    updateData.backgroundStory = input.backgroundStory ?? null;
  }
  if ("firstMessage" in input) {
    updateData.firstMessage = input.firstMessage ?? null;
  }
  if ("avatar" in input) {
    updateData.avatar = input.avatar ?? null;
  }
  if (input.tags !== undefined) {
    updateData.tags = JSON.stringify(input.tags);
  }
  if (input.visibility !== undefined) {
    updateData.visibility = input.visibility;
  }

  try {
    const updated = await prisma.character.update({
      where: { id },
      data: updateData,
      include: characterDetailInclude,
    });

    return NextResponse.json(
      serializeCharacterDetail(updated as CharacterWithFullRelations)
    );
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "중복된 데이터가 존재합니다." },
        { status: 400 }
      );
    }
    throw err;
  }
});

// ─────────────────────────────────────────────
// DELETE /api/characters/[id]
// ─────────────────────────────────────────────
export const DELETE = withDynamicHandler(async (req, context) => {
  const { id } = await context.params;

  // 인증 필수
  const user = await requireAuth();

  // 대상 캐릭터 존재 여부 + 소유자 확인
  const existing = await prisma.character.findUnique({
    where: { id },
    select: { id: true, creatorId: true },
  });

  if (!existing) {
    return NextResponse.json(
      { error: "캐릭터를 찾을 수 없습니다." },
      { status: 404 }
    );
  }

  // 소유자 또는 ADMIN만 삭제 허용
  requireOwnerOrAdmin(existing.creatorId, user.id, user.role);

  // Cascade 삭제 (chatSessions, messages 자동 삭제)
  await prisma.character.delete({ where: { id } });

  return NextResponse.json({ message: "캐릭터가 삭제되었습니다." });
});
