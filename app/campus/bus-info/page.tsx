"use client";

import { Container } from "@/app/components/Container";

import { useState } from "react";
import dynamic from "next/dynamic";
import PublicTransitSection from "./PublicTransitSection";
import clsx from "clsx";

// 셔틀버스 페이지를 동적 임포트 (코드 분할)
const ShuttleSection = dynamic(() => import("../shuttle/page"), {
  loading: () => <div className="py-8">로딩 중...</div>,
});

export default function BusInfoPage() {
  const [activeTab, setActiveTab] = useState<"shuttle" | "public-transit">(
    "shuttle",
  );

  return (
    <>
      <Container className="py-3 sm:py-4 sticky top-0 bg-white z-10 border-b border-neutral-200">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("shuttle")}
            className={clsx(
              "flex-1 px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition-all",
              activeTab === "shuttle"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
            )}
          >
            셔틀버스
          </button>
          <button
            onClick={() => setActiveTab("public-transit")}
            className={clsx(
              "flex-1 px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition-all",
              activeTab === "public-transit"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
            )}
          >
            대중교통
          </button>
        </div>
      </Container>

      <div>
        {activeTab === "shuttle" && <ShuttleSection />}
        {activeTab === "public-transit" && <PublicTransitSection />}
      </div>
    </>
  );
}
