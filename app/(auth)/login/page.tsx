"use client";

import { useState, FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        loginId: loginId.trim(),
        password,
        redirect: false,
      });

      if (!result) {
        setError("로그인 처리 중 오류가 발생했습니다.");
        return;
      }

      if (result.error) {
        setError("아이디 또는 비밀번호가 올바르지 않습니다.");
        return;
      }

      // 로그인 성공 — 메인 페이지로 이동
      router.push("/");
      router.refresh();
    } catch {
      setError("로그인 처리 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <h1 className="text-xl font-semibold text-t1 mb-6 text-center">
        로그인
      </h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {/* 아이디 */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="loginId" className="text-sm text-t2">
            아이디
          </label>
          <input
            id="loginId"
            type="text"
            autoComplete="username"
            value={loginId}
            onChange={(e) => setLoginId(e.target.value)}
            placeholder="영문+숫자 4~20자"
            className="bg-bg3 border border-bg3 focus:border-red/50 rounded-lg px-3 py-2 text-t1 outline-none transition-colors placeholder:text-t2/50"
            required
          />
        </div>

        {/* 비밀번호 */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm text-t2">
            비밀번호
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="비밀번호 입력"
            className="bg-bg3 border border-bg3 focus:border-red/50 rounded-lg px-3 py-2 text-t1 outline-none transition-colors placeholder:text-t2/50"
            required
          />
        </div>

        {/* 에러 메시지 */}
        {error && (
          <p role="alert" className="text-sm text-red bg-red/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {/* 제출 버튼 */}
        <button
          type="submit"
          disabled={isLoading}
          className="mt-2 bg-red text-white rounded-lg px-4 py-2.5 font-medium hover:bg-red/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "로그인 중..." : "로그인"}
        </button>
      </form>

      {/* 회원가입 링크 */}
      <p className="mt-6 text-center text-sm text-t2">
        계정이 없으신가요?{" "}
        <Link
          href="/register"
          className="text-t1 font-medium hover:text-red transition-colors"
        >
          회원가입
        </Link>
      </p>
    </>
  );
}
