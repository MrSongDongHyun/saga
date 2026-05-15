/** @type {import('next').NextConfig} */
const nextConfig = {
  // 실험적 기능 없음 — 안정 설정만 사용
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "7860",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
