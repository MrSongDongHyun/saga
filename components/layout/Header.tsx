"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSession, signOut } from "next-auth/react";

/** 내비게이션 탭 정의 */
const NAV_TABS = [
  { label: "스토리", href: "/" },
  { label: "캐릭터", href: "/characters" },
] as const;

type HeaderProps = {
  onMenuClick?: () => void;
};

export function Header({ onMenuClick }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  async function handleSignOut() {
    setDropdownOpen(false);
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-[60] h-14 bg-bg2 border-b border-bg3 flex items-center px-4 gap-3">
      {/* 햄버거 버튼 — 모바일에서만 표시 */}
      <button
        type="button"
        onClick={onMenuClick}
        className="md:hidden w-8 h-8 flex items-center justify-center text-t2 hover:text-t1 transition-colors rounded-lg hover:bg-bg3"
        aria-label="메뉴 열기"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* 로고 */}
      <Link href="/" className="text-lg font-bold text-t1 tracking-tight select-none mr-2">
        SAGA
      </Link>

      {/* 내비게이션 탭 */}
      <nav className="hidden md:flex items-center gap-1 flex-1">
        {NAV_TABS.map(({ label, href }) => (
          <Link
            key={href}
            href={href}
            className={[
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              isActive(href)
                ? "text-t1 bg-bg3"
                : "text-t2 hover:text-t1 hover:bg-bg3",
            ].join(" ")}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="flex-1 md:flex-none" />

      {/* 우측 영역 */}
      <div className="flex items-center gap-2">
        {status === "loading" ? null : status === "authenticated" && session?.user ? (
          <div className="relative">
            {/* 유저 버튼 */}
            <button
              type="button"
              onClick={() => setDropdownOpen((v) => !v)}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-bg3 transition-colors text-sm text-t1"
              aria-haspopup="true"
              aria-expanded={dropdownOpen}
            >
              <span className="w-6 h-6 rounded-full bg-red/20 text-red flex items-center justify-center text-xs font-bold shrink-0 select-none">
                {(session.user.name ?? "U")[0]?.toUpperCase()}
              </span>
              <span className="hidden sm:block max-w-[80px] truncate">
                {session.user.name ?? "사용자"}
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`hidden sm:block text-t2 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                aria-hidden="true"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>

            {/* 드롭다운 메뉴 */}
            {dropdownOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setDropdownOpen(false)}
                  aria-hidden="true"
                />
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1 w-40 bg-bg2 border border-bg3 rounded-xl shadow-lg z-50 py-1 overflow-hidden"
                >
                  <Link
                    href="/my"
                    role="menuitem"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-t1 hover:bg-bg3 transition-colors"
                  >
                    내 작품
                  </Link>
                  <hr className="border-bg3 mx-2" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleSignOut}
                    className="w-full text-left flex items-center gap-2 px-4 py-2.5 text-sm text-red hover:bg-bg3 transition-colors"
                  >
                    로그아웃
                  </button>
                </div>
              </>
            )}
          </div>
        ) : (
          <Link
            href="/login"
            className="px-3 py-1.5 bg-red hover:bg-red/80 text-white text-sm font-medium rounded-lg transition-colors"
          >
            로그인
          </Link>
        )}
      </div>
    </header>
  );
}
