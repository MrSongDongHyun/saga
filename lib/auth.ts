// NextAuth v5 beta 설정
// Credentials 방식 로그인 (loginId + password)
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/** DB role 컬럼(String)을 유니온 타입으로 좁히는 가드 */
function toRole(value: string): "USER" | "ADMIN" {
  if (value === "ADMIN") return "ADMIN";
  return "USER";
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  // JWT 세션 전략 사용
  session: { strategy: "jwt" },

  // 커스텀 로그인 페이지
  pages: {
    signIn: "/login",
  },

  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        loginId: { label: "아이디", type: "text" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        // 입력값 기본 검증
        if (
          typeof credentials?.loginId !== "string" ||
          typeof credentials?.password !== "string"
        ) {
          return null;
        }

        const { loginId, password } = credentials;

        // DB에서 사용자 조회
        // Prisma SQLite에서 role은 String → 애플리케이션에서 좁힘
        let dbUser: {
          id: string;
          loginId: string;
          password: string;
          nickname: string;
          role: string;
          isActive: boolean;
        } | null;

        try {
          dbUser = await prisma.user.findUnique({
            where: { loginId },
            select: {
              id: true,
              loginId: true,
              password: true,
              nickname: true,
              role: true,
              isActive: true,
            },
          });
        } catch {
          // DB 오류 시 null 반환 (로그인 실패)
          console.error("[auth] DB 조회 오류");
          return null;
        }

        // 사용자 없음 또는 비활성화
        if (!dbUser || !dbUser.isActive) {
          return null;
        }

        // 비밀번호 검증
        const isValid = await bcrypt.compare(password, dbUser.password);
        if (!isValid) {
          return null;
        }

        // NextAuth User 객체 반환 (password 제외)
        // role을 string → "USER" | "ADMIN" 으로 좁힘
        return {
          id: dbUser.id,
          name: dbUser.nickname,
          role: toRole(dbUser.role),
        };
      },
    }),
  ],

  callbacks: {
    // JWT 토큰 생성/갱신 시 호출
    jwt({ token, user }) {
      // 최초 로그인 시 user 객체 존재 → 토큰에 id, role 저장
      if (user) {
        // NextAuth User 타입에는 id가 있지만 JWT 확장 타입과 맞추기 위해 명시
        token.id = user.id ?? "";
        // user는 authorize에서 반환한 객체 — role 필드가 있음
        const userWithRole = user as { role?: "USER" | "ADMIN" };
        token.role = userWithRole.role ?? "USER";
      }
      return token;
    },

    // 세션 조회 시 호출
    session({ session, token }) {
      // token은 JWT 확장 타입이지만 NextAuth v5 beta에서는
      // 콜백 내부에서 unknown으로 추론될 수 있으므로 명시적 캐스팅
      const typedToken = token as { id: string; role: "USER" | "ADMIN" };
      session.user.id = typedToken.id;
      session.user.role = typedToken.role;
      return session;
    },
  },
});
