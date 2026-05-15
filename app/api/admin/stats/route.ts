// 관리자 통계 API
// GET /api/admin/stats
// ADMIN 권한 필요
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/rbac";
import { withHandler } from "@/lib/api-handler";

export const GET = withHandler(async (_req: NextRequest) => {
  // ADMIN 권한 검증
  await requireAdmin();

  // KST 기준 오늘 자정(00:00:00)을 UTC로 계산
  // 문제: now.getUTCDate()는 UTC 날짜이므로 KST 00:00~08:59 구간에
  //       UTC는 아직 전날이어서 todayUsers가 전날까지 합산되는 버그 발생.
  // 해결: UTC 시각에 9시간을 더해 "KST 시각"을 만든 뒤,
  //       그 값에서 UTC 메서드를 호출하면 실제 KST 연/월/일을 얻는다.
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // KST = UTC+9
  const now = new Date();
  // nowKST: UTC 타임스탬프를 9시간 앞당겨서 KST 달력 날짜를 표현하는 객체
  const nowKST = new Date(now.getTime() + KST_OFFSET_MS);
  // getUTCFullYear/Month/Date를 호출하면 KST 연/월/일이 반환됨
  const kstYear = nowKST.getUTCFullYear();
  const kstMonth = nowKST.getUTCMonth();
  const kstDate = nowKST.getUTCDate();
  // KST 자정(00:00 KST) = UTC 기준 전날 15:00 → hours에 -9를 넘기면 JS가 날짜 자동 조정
  const kstMidnightUTC = new Date(Date.UTC(kstYear, kstMonth, kstDate, -9, 0, 0, 0));

  // 병렬로 카운트 쿼리 실행
  const [totalUsers, totalStories, totalCharacters, totalChatSessions, todayUsers] =
    await Promise.all([
      prisma.user.count(),
      prisma.story.count(),
      prisma.character.count(),
      prisma.chatSession.count(),
      // 오늘(KST 기준) 가입한 신규 사용자 수
      prisma.user.count({
        where: {
          createdAt: {
            gte: kstMidnightUTC,
          },
        },
      }),
    ]);

  return NextResponse.json({
    totalUsers,
    totalStories,
    totalCharacters,
    totalChatSessions,
    todayUsers,
  });
});
