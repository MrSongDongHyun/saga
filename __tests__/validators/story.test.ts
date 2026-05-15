// lib/validators/story.ts 단위 테스트
// validateStoryCreate / validateStoryUpdate 검증
import { describe, it, expect } from "vitest";
import {
  validateStoryCreate,
  validateStoryUpdate,
} from "@/lib/validators/story";

// ─────────────────────────────────────────────
// validateStoryCreate
// ─────────────────────────────────────────────
describe("validateStoryCreate", () => {
  // ── 정상 케이스 ───────────────────────────────────────
  it("유효한 최소 입력(title + genre만) → 성공, 기본값 적용 확인", () => {
    const result = validateStoryCreate({
      title: "테스트 스토리",
      genre: ["판타지"],
    });

    expect(result.title).toBe("테스트 스토리");
    expect(result.genre).toEqual(["판타지"]);
    // 기본값 확인
    expect(result.status).toBe("ONGOING");
    expect(result.visibility).toBe("PUBLIC");
    expect(result.tags).toEqual([]);
    expect(result.description).toBeUndefined();
    expect(result.coverImage).toBeUndefined();
  });

  it("유효한 전체 입력 → 성공", () => {
    const result = validateStoryCreate({
      title: "완전한 스토리",
      description: "스토리 설명입니다.",
      genre: ["판타지", "로맨스"],
      tags: ["이세계", "회귀"],
      status: "COMPLETED",
      visibility: "PRIVATE",
      coverImage: "https://example.com/cover.jpg",
    });

    expect(result.title).toBe("완전한 스토리");
    expect(result.description).toBe("스토리 설명입니다.");
    expect(result.genre).toEqual(["판타지", "로맨스"]);
    expect(result.tags).toEqual(["이세계", "회귀"]);
    expect(result.status).toBe("COMPLETED");
    expect(result.visibility).toBe("PRIVATE");
    expect(result.coverImage).toBe("https://example.com/cover.jpg");
  });

  // ── title 검증 ────────────────────────────────────────
  it("title 누락 → 400 throw", () => {
    expect(() =>
      validateStoryCreate({ genre: ["판타지"] })
    ).toThrow();
  });

  it("title 빈 문자열 → 400 throw", () => {
    expect(() =>
      validateStoryCreate({ title: "", genre: ["판타지"] })
    ).toThrow();
  });

  it("title 101자 → 400 throw", () => {
    expect(() =>
      validateStoryCreate({ title: "가".repeat(101), genre: ["판타지"] })
    ).toThrow();
  });

  it("title 100자 → 성공 (최대 허용)", () => {
    const result = validateStoryCreate({
      title: "가".repeat(100),
      genre: ["판타지"],
    });
    expect(result.title).toBe("가".repeat(100));
  });

  // ── description 검증 ──────────────────────────────────
  it("description 501자 → 400 throw", () => {
    expect(() =>
      validateStoryCreate({
        title: "제목",
        genre: ["판타지"],
        description: "가".repeat(501),
      })
    ).toThrow();
  });

  it("description 500자 → 성공 (최대 허용)", () => {
    const result = validateStoryCreate({
      title: "제목",
      genre: ["판타지"],
      description: "가".repeat(500),
    });
    expect(result.description).toBe("가".repeat(500));
  });

  // ── genre 검증 ────────────────────────────────────────
  it("genre 빈 배열 → 400 throw", () => {
    expect(() =>
      validateStoryCreate({ title: "제목", genre: [] })
    ).toThrow();
  });

  it("genre 11개 → 400 throw", () => {
    expect(() =>
      validateStoryCreate({
        title: "제목",
        genre: Array.from({ length: 11 }, (_, i) => `장르${i}`),
      })
    ).toThrow();
  });

  it("genre 10개 → 성공 (최대 허용)", () => {
    const genres = Array.from({ length: 10 }, (_, i) => `장르${i}`);
    const result = validateStoryCreate({ title: "제목", genre: genres });
    expect(result.genre).toHaveLength(10);
  });

  it("genre 항목 21자 → 400 throw", () => {
    expect(() =>
      validateStoryCreate({
        title: "제목",
        genre: ["가".repeat(21)],
      })
    ).toThrow();
  });

  it("genre 항목 20자 → 성공 (최대 허용)", () => {
    const result = validateStoryCreate({
      title: "제목",
      genre: ["가".repeat(20)],
    });
    expect(result.genre[0]).toBe("가".repeat(20));
  });

  // ── tags 검증 ─────────────────────────────────────────
  it("tags 21개 → 400 throw", () => {
    expect(() =>
      validateStoryCreate({
        title: "제목",
        genre: ["판타지"],
        tags: Array.from({ length: 21 }, (_, i) => `태그${i}`),
      })
    ).toThrow();
  });

  it("tags 20개 → 성공 (최대 허용)", () => {
    const tags = Array.from({ length: 20 }, (_, i) => `태그${i}`);
    const result = validateStoryCreate({
      title: "제목",
      genre: ["판타지"],
      tags,
    });
    expect(result.tags).toHaveLength(20);
  });

  it("tags 항목 21자 → 400 throw", () => {
    expect(() =>
      validateStoryCreate({
        title: "제목",
        genre: ["판타지"],
        tags: ["가".repeat(21)],
      })
    ).toThrow();
  });

  it("tags 항목 20자 → 성공 (최대 허용)", () => {
    const result = validateStoryCreate({
      title: "제목",
      genre: ["판타지"],
      tags: ["가".repeat(20)],
    });
    expect(result.tags[0]).toBe("가".repeat(20));
  });

  // ── status 검증 ───────────────────────────────────────
  it("status 잘못된 값 → 400 throw", () => {
    expect(() =>
      validateStoryCreate({
        title: "제목",
        genre: ["판타지"],
        status: "INVALID_STATUS",
      })
    ).toThrow();
  });

  it("status HIATUS → 성공 (허용값)", () => {
    const result = validateStoryCreate({
      title: "제목",
      genre: ["판타지"],
      status: "HIATUS",
    });
    expect(result.status).toBe("HIATUS");
  });

  // ── visibility 검증 ───────────────────────────────────
  it("visibility 잘못된 값 → 400 throw", () => {
    expect(() =>
      validateStoryCreate({
        title: "제목",
        genre: ["판타지"],
        visibility: "INVALID_VIS",
      })
    ).toThrow();
  });

  it("visibility UNLISTED → 성공 (허용값)", () => {
    const result = validateStoryCreate({
      title: "제목",
      genre: ["판타지"],
      visibility: "UNLISTED",
    });
    expect(result.visibility).toBe("UNLISTED");
  });

  // ── coverImage 검증 ───────────────────────────────────
  it("coverImage 501자 → 400 throw", () => {
    expect(() =>
      validateStoryCreate({
        title: "제목",
        genre: ["판타지"],
        coverImage: "a".repeat(501),
      })
    ).toThrow();
  });

  it("coverImage 500자 → 성공 (최대 허용)", () => {
    const result = validateStoryCreate({
      title: "제목",
      genre: ["판타지"],
      coverImage: "a".repeat(500),
    });
    expect(result.coverImage).toBe("a".repeat(500));
  });
});

// ─────────────────────────────────────────────
// validateStoryUpdate
// ─────────────────────────────────────────────
describe("validateStoryUpdate", () => {
  // ── 정상 케이스 ───────────────────────────────────────
  it("빈 객체 → 성공 (빈 UpdateStoryInput 반환)", () => {
    const result = validateStoryUpdate({});
    expect(result).toEqual({});
  });

  it("title만 포함 → 성공", () => {
    const result = validateStoryUpdate({ title: "수정된 제목" });
    expect(result.title).toBe("수정된 제목");
  });

  it("description: null → 성공 (null 허용)", () => {
    const result = validateStoryUpdate({ description: null });
    expect(result.description).toBeNull();
  });

  it("coverImage: null → 성공 (null 허용)", () => {
    const result = validateStoryUpdate({ coverImage: null });
    expect(result.coverImage).toBeNull();
  });

  it("status + visibility 조합 → 성공", () => {
    const result = validateStoryUpdate({
      status: "COMPLETED",
      visibility: "PRIVATE",
    });
    expect(result.status).toBe("COMPLETED");
    expect(result.visibility).toBe("PRIVATE");
  });

  it("genre + tags 조합 → 성공", () => {
    const result = validateStoryUpdate({
      genre: ["로맨스"],
      tags: ["현대물"],
    });
    expect(result.genre).toEqual(["로맨스"]);
    expect(result.tags).toEqual(["현대물"]);
  });

  // ── 오류 케이스 ───────────────────────────────────────
  it("title 빈 문자열 → 400 throw", () => {
    expect(() => validateStoryUpdate({ title: "" })).toThrow();
  });

  it("title 101자 → 400 throw", () => {
    expect(() =>
      validateStoryUpdate({ title: "가".repeat(101) })
    ).toThrow();
  });

  it("status 잘못된 값 → 400 throw", () => {
    expect(() =>
      validateStoryUpdate({ status: "WRONG" })
    ).toThrow();
  });

  it("visibility 잘못된 값 → 400 throw", () => {
    expect(() =>
      validateStoryUpdate({ visibility: "WRONG" })
    ).toThrow();
  });

  it("genre 빈 배열 → 400 throw", () => {
    expect(() => validateStoryUpdate({ genre: [] })).toThrow();
  });

  it("tags 21개 → 400 throw", () => {
    expect(() =>
      validateStoryUpdate({
        tags: Array.from({ length: 21 }, (_, i) => `태그${i}`),
      })
    ).toThrow();
  });

  it("잘못된 요청 형식(null) → 400 throw", () => {
    expect(() => validateStoryUpdate(null)).toThrow();
  });

  it("잘못된 요청 형식(배열) → 필드 없음으로 빈 결과 반환 (배열은 객체이므로 통과)", () => {
    // JS에서 배열은 typeof object이므로 null 체크는 통과함
    // 배열에 정의된 인덱스 키(0,1,...)는 title/genre 등 필드명이 아니므로 result는 빈 객체
    const result = validateStoryUpdate(["잘못된"]);
    expect(result).toEqual({});
  });
});
