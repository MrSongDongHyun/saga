// 테스트 전역 setup
// - 테스트 전용 SQLite DB 경로 설정
// - beforeAll: 마이그레이션 적용
// - beforeEach: 테이블 전체 truncate (격리)
import { execSync } from "child_process";
import path from "path";

// ── 테스트 DB 경로 설정 ─────────────────────────────────────
// 실제 DB(saga.db)와 분리된 테스트 전용 파일
const TEST_DB_PATH = path.resolve(__dirname, "../prisma/saga.test.db");
process.env.DATABASE_URL = `file:${TEST_DB_PATH}`;

// ── PrismaClient (테스트 DB) ────────────────────────────────
// setup.ts는 vitest가 먼저 실행하므로 여기서 import하면 테스트 DB를 바라봄
import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient;

beforeAll(async () => {
  // 테스트 DB에 마이그레이션 적용
  // --skip-generate: client 재생성 없이 SQL만 적용
  execSync("npx prisma migrate deploy", {
    cwd: path.resolve(__dirname, ".."),
    env: { ...process.env, DATABASE_URL: `file:${TEST_DB_PATH}` },
    stdio: "pipe",
  });

  prisma = new PrismaClient({
    datasources: { db: { url: `file:${TEST_DB_PATH}` } },
  });
});

afterAll(async () => {
  await prisma?.$disconnect();
});

beforeEach(async () => {
  // 참조 무결성 때문에 자식 테이블부터 삭제
  // SQLite는 TRUNCATE 미지원 → deleteMany() 사용
  await prisma.$transaction([
    prisma.message.deleteMany(),
    prisma.chatSession.deleteMany(),
    prisma.bookmark.deleteMany(),
    prisma.like.deleteMany(),
    prisma.playStatValue.deleteMany(),
    prisma.playMessage.deleteMany(),
    prisma.playSession.deleteMany(),
    prisma.endingCondition.deleteMany(),
    prisma.storyEnding.deleteMany(),
    prisma.statLevel.deleteMany(),
    prisma.storyStatDef.deleteMany(),
    prisma.storyMedia.deleteMany(),
    prisma.chapter.deleteMany(),
    prisma.story.deleteMany(),
    prisma.character.deleteMany(),
    prisma.user.deleteMany(),
  ]);
});

// 다른 테스트 파일에서 공유 prisma 인스턴스 사용
export function getTestPrisma(): PrismaClient {
  return prisma;
}
