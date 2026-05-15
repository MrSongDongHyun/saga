import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SAGA — 로그인",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center px-4">
      {/* 상단 로고 */}
      <Link
        href="/"
        className="mb-8 text-3xl font-bold tracking-[0.25em] text-t1 hover:text-red transition-colors"
      >
        SAGA
      </Link>

      {/* 콘텐츠 카드 */}
      <div className="w-full max-w-sm bg-bg2 rounded-2xl p-8 shadow-xl">
        {children}
      </div>

      {/* 하단 푸터 */}
      <p className="mt-6 text-xs text-t2">
        &copy; {new Date().getFullYear()} SAGA. All rights reserved.
      </p>
    </div>
  );
}
