// lib/serializers/story.ts 단위 테스트
// serializeStoryList / serializeStoryDetail / safeParseArray 검증
import { describe, it, expect } from "vitest";
import {
  serializeStoryList,
  serializeStoryDetail,
  type StoryWithCountAndAuthor,
  type StoryWithFullRelations,
} from "@/lib/serializers/story";

// ─────────────────────────────────────────────
// 테스트용 픽스처 팩토리
// ─────────────────────────────────────────────

/** 목록용 Prisma 원시 데이터 생성 헬퍼 */
function makeRawStory(
  overrides: Partial<StoryWithCountAndAuthor> = {}
): StoryWithCountAndAuthor {
  const now = new Date("2025-05-15T10:00:00.000Z");
  return {
    id: "story-id-001",
    title: "테스트 스토리",
    description: "스토리 설명",
    genre: '["판타지","로맨스"]',
    tags: '["이세계","회귀"]',
    status: "ONGOING",
    visibility: "PUBLIC",
    coverImage: null,
    viewCount: 42,
    authorId: "author-id-001",
    createdAt: now,
    updatedAt: now,
    author: {
      id: "author-id-001",
      nickname: "작가닉네임",
      profileImage: null,
    },
    _count: {
      likes: 10,
      bookmarks: 5,
      chapters: 3,
    },
    ...overrides,
  };
}

/** 상세용 Prisma 원시 데이터 생성 헬퍼 */
function makeRawStoryDetail(
  overrides: Partial<StoryWithFullRelations> = {}
): StoryWithFullRelations {
  const now = new Date("2025-05-15T10:00:00.000Z");
  return {
    id: "story-id-001",
    title: "테스트 스토리",
    description: "스토리 설명",
    genre: '["판타지","로맨스"]',
    tags: '["이세계","회귀"]',
    status: "ONGOING",
    visibility: "PUBLIC",
    coverImage: null,
    viewCount: 42,
    authorId: "author-id-001",
    createdAt: now,
    updatedAt: now,
    author: {
      id: "author-id-001",
      nickname: "작가닉네임",
      profileImage: null,
    },
    chapters: [
      {
        id: "chapter-id-001",
        title: "1화: 시작",
        orderIndex: 1,
        isPublished: true,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: "chapter-id-002",
        title: "2화: 전개",
        orderIndex: 2,
        isPublished: false,
        createdAt: now,
        updatedAt: now,
      },
    ],
    _count: {
      likes: 10,
      bookmarks: 5,
      chapters: 2,
    },
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// serializeStoryList
// ─────────────────────────────────────────────
describe("serializeStoryList", () => {
  it("genre JSON 문자열 → string[] 파싱 확인", () => {
    const raw = makeRawStory({ genre: '["판타지","로맨스","SF"]' });
    const result = serializeStoryList(raw);
    expect(result.genre).toEqual(["판타지", "로맨스", "SF"]);
    expect(Array.isArray(result.genre)).toBe(true);
  });

  it("tags JSON 문자열 → string[] 파싱 확인", () => {
    const raw = makeRawStory({ tags: '["이세계","회귀","헌터"]' });
    const result = serializeStoryList(raw);
    expect(result.tags).toEqual(["이세계", "회귀", "헌터"]);
    expect(Array.isArray(result.tags)).toBe(true);
  });

  it("날짜 → ISO 문자열 변환 확인", () => {
    const specificDate = new Date("2025-01-15T09:30:00.000Z");
    const raw = makeRawStory({ createdAt: specificDate, updatedAt: specificDate });
    const result = serializeStoryList(raw);
    expect(result.createdAt).toBe("2025-01-15T09:30:00.000Z");
    expect(result.updatedAt).toBe("2025-01-15T09:30:00.000Z");
    expect(typeof result.createdAt).toBe("string");
    expect(typeof result.updatedAt).toBe("string");
  });

  it("_count 카운트 필드 확인 (likeCount, bookmarkCount, chapterCount)", () => {
    const raw = makeRawStory({
      _count: { likes: 7, bookmarks: 3, chapters: 12 },
    });
    const result = serializeStoryList(raw);
    expect(result.likeCount).toBe(7);
    expect(result.bookmarkCount).toBe(3);
    expect(result.chapterCount).toBe(12);
  });

  it("viewCount 그대로 전달", () => {
    const raw = makeRawStory({ viewCount: 999 });
    const result = serializeStoryList(raw);
    expect(result.viewCount).toBe(999);
  });

  it("description null → null 반환", () => {
    const raw = makeRawStory({ description: null });
    const result = serializeStoryList(raw);
    expect(result.description).toBeNull();
  });

  it("coverImage null → null 반환", () => {
    const raw = makeRawStory({ coverImage: null });
    const result = serializeStoryList(raw);
    expect(result.coverImage).toBeNull();
  });

  it("coverImage 값 있을 때 그대로 반환", () => {
    const raw = makeRawStory({ coverImage: "https://example.com/cover.jpg" });
    const result = serializeStoryList(raw);
    expect(result.coverImage).toBe("https://example.com/cover.jpg");
  });

  it("author 정보 포함 확인", () => {
    const raw = makeRawStory({
      author: {
        id: "author-abc",
        nickname: "저자이름",
        profileImage: "https://example.com/profile.jpg",
      },
    });
    const result = serializeStoryList(raw);
    expect(result.author.id).toBe("author-abc");
    expect(result.author.nickname).toBe("저자이름");
    expect(result.author.profileImage).toBe("https://example.com/profile.jpg");
  });

  it("author profileImage null → null 반환", () => {
    const raw = makeRawStory({
      author: { id: "a", nickname: "닉", profileImage: null },
    });
    const result = serializeStoryList(raw);
    expect(result.author.profileImage).toBeNull();
  });

  it("chapters 필드 없음 (목록용 최적화)", () => {
    const raw = makeRawStory();
    const result = serializeStoryList(raw);
    // StoryListItem 타입에는 chapters 없음
    expect((result as Record<string, unknown>).chapters).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// serializeStoryDetail
// ─────────────────────────────────────────────
describe("serializeStoryDetail", () => {
  it("chapters 포함 확인", () => {
    const raw = makeRawStoryDetail();
    const result = serializeStoryDetail(raw);
    expect(Array.isArray(result.chapters)).toBe(true);
    expect(result.chapters).toHaveLength(2);
  });

  it("chapters 필드 구조 확인 (id, title, orderIndex, isPublished, createdAt, updatedAt)", () => {
    const raw = makeRawStoryDetail();
    const result = serializeStoryDetail(raw);
    const ch = result.chapters[0];
    expect(ch).toHaveProperty("id");
    expect(ch).toHaveProperty("title");
    expect(ch).toHaveProperty("orderIndex");
    expect(ch).toHaveProperty("isPublished");
    expect(ch).toHaveProperty("createdAt");
    expect(ch).toHaveProperty("updatedAt");
  });

  it("chapters 날짜 → ISO 문자열 변환", () => {
    const raw = makeRawStoryDetail();
    const result = serializeStoryDetail(raw);
    expect(typeof result.chapters[0].createdAt).toBe("string");
    expect(result.chapters[0].createdAt).toBe("2025-05-15T10:00:00.000Z");
  });

  it("options 없을 때 isLiked/isBookmarked 포함되지 않음", () => {
    const raw = makeRawStoryDetail();
    const result = serializeStoryDetail(raw);
    expect((result as Record<string, unknown>).isLiked).toBeUndefined();
    expect((result as Record<string, unknown>).isBookmarked).toBeUndefined();
  });

  it("options.isLiked=true → isLiked: true 포함", () => {
    const raw = makeRawStoryDetail();
    const result = serializeStoryDetail(raw, { isLiked: true });
    expect(result.isLiked).toBe(true);
  });

  it("options.isLiked=false → isLiked: false 포함", () => {
    const raw = makeRawStoryDetail();
    const result = serializeStoryDetail(raw, { isLiked: false });
    expect(result.isLiked).toBe(false);
  });

  it("options.isBookmarked=true → isBookmarked: true 포함", () => {
    const raw = makeRawStoryDetail();
    const result = serializeStoryDetail(raw, { isBookmarked: true });
    expect(result.isBookmarked).toBe(true);
  });

  it("options.isBookmarked=false → isBookmarked: false 포함", () => {
    const raw = makeRawStoryDetail();
    const result = serializeStoryDetail(raw, { isBookmarked: false });
    expect(result.isBookmarked).toBe(false);
  });

  it("options에 isLiked만 있으면 isBookmarked는 undefined", () => {
    const raw = makeRawStoryDetail();
    const result = serializeStoryDetail(raw, { isLiked: true });
    expect(result.isLiked).toBe(true);
    expect((result as Record<string, unknown>).isBookmarked).toBeUndefined();
  });

  it("빈 chapters 배열 → 빈 배열 반환", () => {
    const raw = makeRawStoryDetail({ chapters: [] });
    const result = serializeStoryDetail(raw);
    expect(result.chapters).toEqual([]);
  });

  it("genre/tags JSON 파싱 상세에서도 동작", () => {
    const raw = makeRawStoryDetail({
      genre: '["액션","판타지"]',
      tags: '["용사","마법사"]',
    });
    const result = serializeStoryDetail(raw);
    expect(result.genre).toEqual(["액션", "판타지"]);
    expect(result.tags).toEqual(["용사", "마법사"]);
  });
});

// ─────────────────────────────────────────────
// safeParseArray 방어 코드 (간접 테스트)
// serializeStoryList/serializeStoryDetail에 잘못된 JSON 전달
// ─────────────────────────────────────────────
describe("safeParseArray 방어 코드", () => {
  it("genre가 잘못된 JSON → 빈 배열 반환", () => {
    const raw = makeRawStory({ genre: "이건 JSON이 아님" });
    const result = serializeStoryList(raw);
    expect(result.genre).toEqual([]);
  });

  it("tags가 잘못된 JSON → 빈 배열 반환", () => {
    const raw = makeRawStory({ tags: "{잘못된:json}" });
    const result = serializeStoryList(raw);
    expect(result.tags).toEqual([]);
  });

  it("genre가 JSON 객체(배열 아님) → 빈 배열 반환", () => {
    // JSON 파싱은 성공하지만 배열이 아닌 경우
    const raw = makeRawStory({ genre: '{"key":"value"}' });
    const result = serializeStoryList(raw);
    expect(result.genre).toEqual([]);
  });

  it("genre가 빈 JSON 배열 → 빈 배열 반환", () => {
    const raw = makeRawStory({ genre: "[]" });
    const result = serializeStoryList(raw);
    expect(result.genre).toEqual([]);
  });

  it("genre에 숫자 항목 포함 → 문자열만 필터링", () => {
    // safeParseArray는 string만 반환
    const raw = makeRawStory({ genre: '["판타지", 123, "로맨스"]' });
    const result = serializeStoryList(raw);
    expect(result.genre).toEqual(["판타지", "로맨스"]);
  });
});
