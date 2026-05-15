// 랭킹 번호 뱃지 컴포넌트 (01, 02, 03...)
// 상위 3위는 강조 스타일, 나머지는 일반 스타일

export type NumberBadgeProps = {
  rank: number;
};

export function NumberBadge({ rank }: NumberBadgeProps) {
  // 상위 3위 강조 색상
  const isTop3 = rank <= 3;

  return (
    <span
      className={[
        "text-xs font-bold tabular-nums leading-none",
        isTop3 ? "text-red" : "text-t2",
      ].join(" ")}
    >
      {String(rank).padStart(2, "0")}
    </span>
  );
}
