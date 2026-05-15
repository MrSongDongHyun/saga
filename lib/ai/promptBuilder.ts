// 캐릭터 프롬프트 빌더
// L1~L6 레이어 구조로 캐릭터 시스템 프롬프트를 조립
// 각 레이어는 독립적으로 존재하며 데이터가 없으면 해당 레이어 생략

// ─────────────────────────────────────────────
// 타입 정의
// ─────────────────────────────────────────────

export type CharacterPromptData = {
  name: string;
  description?: string | null;
  personality?: string | null;
  backgroundStory?: string | null;
  firstMessage?: string | null;
  tags: string[];
};

// ─────────────────────────────────────────────
// 레이어 빌더 내부 함수
// ─────────────────────────────────────────────

/**
 * L1: 기본 역할 설정
 * 캐릭터 이름과 기본 역할 부여
 */
function buildL1Role(name: string): string {
  return `너는 "${name}"이야. 지금부터 이 캐릭터로서 대화해줘. 항상 이 캐릭터의 말투와 태도를 유지해.`;
}

/**
 * L2: 성격 주입
 * personality 필드가 있을 때만 추가
 */
function buildL2Personality(personality: string | null | undefined): string {
  if (!personality?.trim()) return "";
  return `[성격]\n${personality.trim()}`;
}

/**
 * L3: 배경 스토리
 * backgroundStory 필드가 있을 때만 추가
 */
function buildL3Background(backgroundStory: string | null | undefined): string {
  if (!backgroundStory?.trim()) return "";
  return `[배경 이야기]\n${backgroundStory.trim()}`;
}

/**
 * L4: 대화 스타일 힌트 (tags 기반)
 * 태그에서 말투/분위기 관련 키워드를 추출하여 스타일 가이드 생성
 */
function buildL4Style(tags: string[]): string {
  if (tags.length === 0) return "";

  // 태그를 쉼표로 나열하여 스타일 참고 정보로 제공
  const tagList = tags.map((t) => `#${t}`).join(" ");
  return `[캐릭터 태그 / 분위기 참고]\n${tagList}`;
}

/**
 * L5: 안전 가이드라인
 * 항상 포함되는 고정 레이어
 */
function buildL5Safety(): string {
  return `[대화 원칙]
- 항상 캐릭터의 관점과 말투로 대화해.
- 현실의 유해하거나 불법적인 정보는 제공하지 마.
- 대화 상대방을 존중하고 건전한 상호작용을 유지해.
- 만약 대화가 불건전한 방향으로 흐를 경우 캐릭터답게 자연스럽게 화제를 전환해.`;
}

/**
 * L6: 첫 인사말 힌트
 * firstMessage가 있을 경우 캐릭터의 기본 인사 스타일을 알려줌
 */
function buildL6FirstMessage(firstMessage: string | null | undefined): string {
  if (!firstMessage?.trim()) return "";
  return `[첫 인사말 예시 — 이 캐릭터의 기본 인사 스타일 참고]\n"${firstMessage.trim()}"`;
}

// ─────────────────────────────────────────────
// 공개 함수
// ─────────────────────────────────────────────

/**
 * 캐릭터 데이터를 바탕으로 Claude용 시스템 프롬프트 조립
 *
 * L1: 역할 설정 (필수)
 * L2: 성격 (personality 있을 때)
 * L3: 배경 이야기 (backgroundStory 있을 때)
 * L4: 태그 기반 스타일 힌트 (tags 있을 때)
 * L5: 안전 가이드라인 (항상 포함)
 * L6: 첫 인사말 힌트 (firstMessage 있을 때)
 *
 * @param character  캐릭터 프롬프트 데이터
 * @returns          조립된 시스템 프롬프트 문자열
 */
export function buildCharacterSystemPrompt(
  character: CharacterPromptData
): string {
  const layers: string[] = [];

  // L1: 기본 역할 (항상 포함)
  layers.push(buildL1Role(character.name));

  // L2: 성격 (선택)
  const l2 = buildL2Personality(character.personality);
  if (l2) layers.push(l2);

  // L3: 배경 이야기 (선택)
  const l3 = buildL3Background(character.backgroundStory);
  if (l3) layers.push(l3);

  // L4: 태그 스타일 (선택)
  const l4 = buildL4Style(character.tags);
  if (l4) layers.push(l4);

  // L5: 안전 가이드라인 (항상 포함)
  layers.push(buildL5Safety());

  // L6: 첫 인사말 힌트 (선택)
  const l6 = buildL6FirstMessage(character.firstMessage);
  if (l6) layers.push(l6);

  return layers.join("\n\n");
}

// ─────────────────────────────────────────────
// 키워드북 — 키워드 감지 & 컨텍스트 삽입
// ─────────────────────────────────────────────

export type KeywordEntry = {
  keyword: string;
  content: string;
};

/**
 * 사용자 메시지에서 키워드를 감지하여 매칭된 content 목록을 반환
 * 대소문자 무시, 부분 문자열 매치
 */
export function detectKeywords(
  message: string,
  keywords: KeywordEntry[]
): string[] {
  const lower = message.toLowerCase();
  const matched: string[] = [];
  for (const kw of keywords) {
    if (lower.includes(kw.keyword.toLowerCase())) {
      matched.push(kw.content);
    }
  }
  return matched;
}

/**
 * 감지된 키워드 컨텍스트를 프롬프트 삽입용 블록으로 포맷
 */
export function buildKeywordContext(contents: string[]): string {
  if (contents.length === 0) return "";
  return `[세계관 참고 정보 — 아래 내용을 대화에 자연스럽게 반영]\n${contents.join("\n\n")}`;
}

// ─────────────────────────────────────────────
// 유저노트 — L4 레이어
// ─────────────────────────────────────────────

/**
 * 유저노트를 시스템 프롬프트에 삽입할 L4 레이어로 변환
 */
export function buildUserNoteLayer(note: string): string {
  if (!note?.trim()) return "";
  return `[사용자 메모 — 반드시 기억하고 대화에 반영]\n${note.trim()}`;
}
