// lib/validators/character.ts 단위 테스트
// validateCharacterCreate / validateCharacterUpdate 검증
import { describe, it, expect } from "vitest";
import {
  validateCharacterCreate,
  validateCharacterUpdate,
} from "@/lib/validators/character";

// ─────────────────────────────────────────────
// validateCharacterCreate
// ─────────────────────────────────────────────
describe("validateCharacterCreate", () => {
  // ── 정상 케이스 ───────────────────────────────────────
  it("최소 입력(name만) → 성공, 기본값(tags:[], visibility:PUBLIC) 확인", () => {
    const result = validateCharacterCreate({ name: "테스트 캐릭터" });

    expect(result.name).toBe("테스트 캐릭터");
    expect(result.tags).toEqual([]);
    expect(result.visibility).toBe("PUBLIC");
    expect(result.description).toBeUndefined();
    expect(result.personality).toBeUndefined();
    expect(result.backgroundStory).toBeUndefined();
    expect(result.firstMessage).toBeUndefined();
    expect(result.avatar).toBeUndefined();
  });

  it("전체 입력 → 성공", () => {
    const result = validateCharacterCreate({
      name: "완전한 캐릭터",
      description: "소개입니다.",
      personality: "밝고 활발한 성격",
      backgroundStory: "먼 왕국에서 태어난...",
      firstMessage: "안녕하세요!",
      avatar: "https://example.com/avatar.png",
      tags: ["판타지", "마법사"],
      visibility: "PRIVATE",
    });

    expect(result.name).toBe("완전한 캐릭터");
    expect(result.description).toBe("소개입니다.");
    expect(result.personality).toBe("밝고 활발한 성격");
    expect(result.backgroundStory).toBe("먼 왕국에서 태어난...");
    expect(result.firstMessage).toBe("안녕하세요!");
    expect(result.avatar).toBe("https://example.com/avatar.png");
    expect(result.tags).toEqual(["판타지", "마법사"]);
    expect(result.visibility).toBe("PRIVATE");
  });

  // ── name 검증 ─────────────────────────────────────────
  it("name 51자 → 400 throw", () => {
    expect(() =>
      validateCharacterCreate({ name: "가".repeat(51) })
    ).toThrow();
  });

  it("name 50자 → 성공 (최대 허용)", () => {
    const result = validateCharacterCreate({ name: "가".repeat(50) });
    expect(result.name).toBe("가".repeat(50));
  });

  it("name 누락 → 400 throw", () => {
    expect(() => validateCharacterCreate({})).toThrow();
  });

  // ── description 검증 ──────────────────────────────────
  it("description 1001자 → 400 throw", () => {
    expect(() =>
      validateCharacterCreate({
        name: "캐릭터",
        description: "가".repeat(1001),
      })
    ).toThrow();
  });

  it("description 1000자 → 성공 (최대 허용)", () => {
    const result = validateCharacterCreate({
      name: "캐릭터",
      description: "가".repeat(1000),
    });
    expect(result.description).toBe("가".repeat(1000));
  });

  // ── personality 검증 ──────────────────────────────────
  it("personality 2001자 → 400 throw", () => {
    expect(() =>
      validateCharacterCreate({
        name: "캐릭터",
        personality: "가".repeat(2001),
      })
    ).toThrow();
  });

  it("personality 2000자 → 성공 (최대 허용)", () => {
    const result = validateCharacterCreate({
      name: "캐릭터",
      personality: "가".repeat(2000),
    });
    expect(result.personality).toBe("가".repeat(2000));
  });

  // ── backgroundStory 검증 ──────────────────────────────
  it("backgroundStory 3001자 → 400 throw", () => {
    expect(() =>
      validateCharacterCreate({
        name: "캐릭터",
        backgroundStory: "가".repeat(3001),
      })
    ).toThrow();
  });

  it("backgroundStory 3000자 → 성공 (최대 허용)", () => {
    const result = validateCharacterCreate({
      name: "캐릭터",
      backgroundStory: "가".repeat(3000),
    });
    expect(result.backgroundStory).toBe("가".repeat(3000));
  });

  // ── firstMessage 검증 ────────────────────────────────
  it("firstMessage 501자 → 400 throw", () => {
    expect(() =>
      validateCharacterCreate({
        name: "캐릭터",
        firstMessage: "가".repeat(501),
      })
    ).toThrow();
  });

  it("firstMessage 500자 → 성공 (최대 허용)", () => {
    const result = validateCharacterCreate({
      name: "캐릭터",
      firstMessage: "가".repeat(500),
    });
    expect(result.firstMessage).toBe("가".repeat(500));
  });

  // ── avatar 검증 ───────────────────────────────────────
  it("avatar 501자 → 400 throw", () => {
    expect(() =>
      validateCharacterCreate({
        name: "캐릭터",
        avatar: "a".repeat(501),
      })
    ).toThrow();
  });

  it("avatar 500자 → 성공 (최대 허용)", () => {
    const result = validateCharacterCreate({
      name: "캐릭터",
      avatar: "a".repeat(500),
    });
    expect(result.avatar).toBe("a".repeat(500));
  });

  // ── tags 검증 ─────────────────────────────────────────
  it("tags 21개 → 400 throw", () => {
    expect(() =>
      validateCharacterCreate({
        name: "캐릭터",
        tags: Array.from({ length: 21 }, (_, i) => `태그${i}`),
      })
    ).toThrow();
  });

  it("tags 20개 → 성공 (최대 허용)", () => {
    const tags = Array.from({ length: 20 }, (_, i) => `태그${i}`);
    const result = validateCharacterCreate({ name: "캐릭터", tags });
    expect(result.tags).toHaveLength(20);
  });

  it("tags 항목 21자 → 400 throw", () => {
    expect(() =>
      validateCharacterCreate({
        name: "캐릭터",
        tags: ["가".repeat(21)],
      })
    ).toThrow();
  });

  it("tags 항목 20자 → 성공 (최대 허용)", () => {
    const result = validateCharacterCreate({
      name: "캐릭터",
      tags: ["가".repeat(20)],
    });
    expect(result.tags[0]).toBe("가".repeat(20));
  });

  // ── visibility 검증 ───────────────────────────────────
  it("visibility 잘못된 값 → 400 throw", () => {
    expect(() =>
      validateCharacterCreate({
        name: "캐릭터",
        visibility: "INVALID_VIS",
      })
    ).toThrow();
  });

  it("visibility UNLISTED → 성공 (허용값)", () => {
    const result = validateCharacterCreate({
      name: "캐릭터",
      visibility: "UNLISTED",
    });
    expect(result.visibility).toBe("UNLISTED");
  });

  it("잘못된 요청 형식(null) → 400 throw", () => {
    expect(() => validateCharacterCreate(null)).toThrow();
  });
});

// ─────────────────────────────────────────────
// validateCharacterUpdate
// ─────────────────────────────────────────────
describe("validateCharacterUpdate", () => {
  // ── 정상 케이스 ───────────────────────────────────────
  it("빈 객체 → 성공 (빈 UpdateCharacterInput 반환)", () => {
    const result = validateCharacterUpdate({});
    expect(result).toEqual({});
  });

  it("name만 포함 → 성공", () => {
    const result = validateCharacterUpdate({ name: "수정된 이름" });
    expect(result.name).toBe("수정된 이름");
  });

  it("description: null → 성공 (null 허용)", () => {
    const result = validateCharacterUpdate({ description: null });
    expect(result.description).toBeNull();
  });

  it("avatar: null → 성공 (null 허용)", () => {
    const result = validateCharacterUpdate({ avatar: null });
    expect(result.avatar).toBeNull();
  });

  it("personality: null → 성공 (null 허용)", () => {
    const result = validateCharacterUpdate({ personality: null });
    expect(result.personality).toBeNull();
  });

  it("backgroundStory: null → 성공 (null 허용)", () => {
    const result = validateCharacterUpdate({ backgroundStory: null });
    expect(result.backgroundStory).toBeNull();
  });

  it("firstMessage: null → 성공 (null 허용)", () => {
    const result = validateCharacterUpdate({ firstMessage: null });
    expect(result.firstMessage).toBeNull();
  });

  it("visibility + tags 조합 → 성공", () => {
    const result = validateCharacterUpdate({
      visibility: "PRIVATE",
      tags: ["새태그"],
    });
    expect(result.visibility).toBe("PRIVATE");
    expect(result.tags).toEqual(["새태그"]);
  });

  // ── 오류 케이스 ───────────────────────────────────────
  it("name 빈 문자열 → 400 throw", () => {
    expect(() => validateCharacterUpdate({ name: "" })).toThrow();
  });

  it("name 51자 → 400 throw", () => {
    expect(() =>
      validateCharacterUpdate({ name: "가".repeat(51) })
    ).toThrow();
  });

  it("visibility 잘못된 값 → 400 throw", () => {
    expect(() =>
      validateCharacterUpdate({ visibility: "WRONG" })
    ).toThrow();
  });

  it("tags 21개 → 400 throw", () => {
    expect(() =>
      validateCharacterUpdate({
        tags: Array.from({ length: 21 }, (_, i) => `태그${i}`),
      })
    ).toThrow();
  });

  it("잘못된 요청 형식(null) → 400 throw", () => {
    expect(() => validateCharacterUpdate(null)).toThrow();
  });
});
