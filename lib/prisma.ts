// PrismaClient 싱글톤
// Next.js 개발 환경에서 Hot Reload 시 중복 인스턴스 생성 방지
import { PrismaClient } from "@prisma/client";

// globalThis에 캐싱하여 모듈 재평가 시 재사용
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

// 개발 환경에서만 globalThis에 저장 (프로덕션은 매번 새 인스턴스)
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
