// 장르 목록 상수 — 스토리 생성/수정 폼에서 공유
export const GENRES = [
  "로맨스",
  "판타지",
  "현대",
  "무협",
  "SF",
  "공포",
  "미스터리",
  "역사",
  "학원",
  "일상",
] as const;

export type Genre = (typeof GENRES)[number];
