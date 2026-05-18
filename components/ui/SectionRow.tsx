import Link from "next/link";
import { ReactNode } from "react";

type Props = {
  title: string;
  seeAllHref?: string;
  /** "scroll" — 가로 스크롤 (기본) | "grid" — 최대 6열 wrap 그리드 */
  variant?: "scroll" | "grid";
  children: ReactNode;
};

export default function SectionRow({ title, seeAllHref, variant = "scroll", children }: Props) {
  const listClass =
    variant === "grid"
      ? "flex flex-wrap gap-3 px-4 md:px-6 pb-4"
      : "flex gap-3 md:gap-4 overflow-x-auto pb-4 px-4 md:px-6 scrollbar-hide";

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between px-4 md:px-6">
        <h2 className="text-base font-semibold text-t1">{title}</h2>
        {seeAllHref && (
          <Link href={seeAllHref} className="text-xs text-t2 hover:text-t1 transition-colors">
            전체보기
          </Link>
        )}
      </div>
      <div className={listClass}>{children}</div>
    </section>
  );
}
