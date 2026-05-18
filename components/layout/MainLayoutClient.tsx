"use client";

import { useState } from "react";
import { Header } from "@/components/layout/Header";
import { Sidebar } from "@/components/layout/Sidebar";

export function MainLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      {/* 상단 고정 헤더 (높이 56px = h-14), z-[60]으로 사이드바 오버레이보다 위 */}
      <Header onMenuClick={() => setSidebarOpen(true)} />

      {/* 헤더 아래 전체 영역 */}
      <div className="flex pt-14 min-h-screen">
        {/* 사이드바: 모바일=오버레이 드로어, PC=고정 240px */}
        <Sidebar
          mobileOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        {/* 메인 콘텐츠 영역 — 모바일 하단 탭바(64px) 만큼 패딩 추가 */}
        <main className="flex-1 overflow-auto min-w-0 pb-16 md:pb-0">
          {children}
        </main>
      </div>
    </>
  );
}
