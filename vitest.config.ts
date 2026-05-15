// vitest 설정 — 서버 사이드 테스트 전용
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // css/postcss는 서버 사이드 테스트에서 불필요 — PostCSS 플러그인 로드 방지
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    // Node 환경 (Next.js API Route 테스트)
    environment: "node",

    // describe/it/expect/beforeAll 등을 전역으로 주입
    globals: true,

    // 각 테스트 파일 실행 전 setup 파일 로드
    setupFiles: ["__tests__/setup.ts"],

    // 테스트 파일 위치
    include: ["__tests__/**/*.test.ts"],

    // 순차 실행 — SQLite 동시 접근 충돌 방지
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },

    // 타임아웃: DB 마이그레이션 고려해 여유 있게
    testTimeout: 30000,
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      // tsconfig paths "@/*" → 프로젝트 루트
      "@": path.resolve(__dirname, "."),
    },
  },
});
