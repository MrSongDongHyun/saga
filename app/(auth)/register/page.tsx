"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

/** 필드별 에러 상태 */
type FieldErrors = {
  loginId?: string;
  password?: string;
  nickname?: string;
  general?: string;
};

export default function RegisterPage() {
  const router = useRouter();

  const [loginId, setLoginId] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrors({});
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loginId: loginId.trim(),
          password,
          nickname: nickname.trim(),
        }),
      });

      if (res.ok) {
        // 가입 성공 — 로그인 페이지로 이동
        router.push("/login?registered=1");
        return;
      }

      // 에러 응답 파싱
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        setErrors({ general: "서버 응답을 처리할 수 없습니다." });
        return;
      }

      if (
        typeof body === "object" &&
        body !== null &&
        "error" in body &&
        typeof (body as Record<string, unknown>).error === "string"
      ) {
        const { error, field } = body as {
          error: string;
          field?: string;
        };

        if (
          field === "loginId" ||
          field === "password" ||
          field === "nickname"
        ) {
          setErrors({ [field]: error });
        } else {
          setErrors({ general: error });
        }
      } else {
        setErrors({ general: "회원가입 중 오류가 발생했습니다." });
      }
    } catch {
      setErrors({ general: "네트워크 오류가 발생했습니다. 다시 시도해주세요." });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <h1 className="text-xl font-semibold text-t1 mb-6 text-center">
        회원가입
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
            className={[
              "bg-bg3 border rounded-lg px-3 py-2 text-t1 outline-none transition-colors placeholder:text-t2/50",
              errors.loginId
                ? "border-red/70 focus:border-red"
                : "border-bg3 focus:border-red/50",
            ].join(" ")}
            required
          />
          {errors.loginId && (
            <p role="alert" className="text-xs text-red">
              {errors.loginId}
            </p>
          )}
        </div>

        {/* 비밀번호 */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm text-t2">
            비밀번호
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="6자 이상"
            className={[
              "bg-bg3 border rounded-lg px-3 py-2 text-t1 outline-none transition-colors placeholder:text-t2/50",
              errors.password
                ? "border-red/70 focus:border-red"
                : "border-bg3 focus:border-red/50",
            ].join(" ")}
            required
          />
          {errors.password && (
            <p role="alert" className="text-xs text-red">
              {errors.password}
            </p>
          )}
        </div>

        {/* 닉네임 */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="nickname" className="text-sm text-t2">
            닉네임
          </label>
          <input
            id="nickname"
            type="text"
            autoComplete="nickname"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="2~15자"
            className={[
              "bg-bg3 border rounded-lg px-3 py-2 text-t1 outline-none transition-colors placeholder:text-t2/50",
              errors.nickname
                ? "border-red/70 focus:border-red"
                : "border-bg3 focus:border-red/50",
            ].join(" ")}
            required
          />
          {errors.nickname && (
            <p role="alert" className="text-xs text-red">
              {errors.nickname}
            </p>
          )}
        </div>

        {/* 일반 에러 */}
        {errors.general && (
          <p role="alert" className="text-sm text-red bg-red/10 rounded-lg px-3 py-2">
            {errors.general}
          </p>
        )}

        {/* 제출 버튼 */}
        <button
          type="submit"
          disabled={isLoading}
          className="mt-2 bg-red text-white rounded-lg px-4 py-2.5 font-medium hover:bg-red/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "가입 중..." : "회원가입"}
        </button>
      </form>

      {/* 로그인 링크 */}
      <p className="mt-6 text-center text-sm text-t2">
        이미 계정이 있으신가요?{" "}
        <Link
          href="/login"
          className="text-t1 font-medium hover:text-red transition-colors"
        >
          로그인
        </Link>
      </p>
    </>
  );
}
