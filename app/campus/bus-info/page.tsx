"use client";

import { Container } from "@/app/components/Container";

import { useState } from "react";
import dynamic from "next/dynamic";
import PublicTransitSection from "./PublicTransitSection";
import clsx from "clsx";
import { useDictionary } from "@/app/components/LocaleProvider";

function ShuttleSectionLoading() {
  const dictionary = useDictionary();

  return <div className="py-8">{dictionary.pages.busInfo.loading}</div>;
}

// 셔틀버스 섹션을 동적 임포트 (코드 분할)
const ShuttleSection = dynamic(() => import("./ShuttleSection"), {
  loading: () => <ShuttleSectionLoading />,
});

export default function BusInfoPage() {
  const dictionary = useDictionary();
  const text = dictionary.pages.busInfo;
  const [activeTab, setActiveTab] = useState<"shuttle" | "public-transit">(
    "shuttle",
  );

  return (
    <>
      <Container className="py-3 sm:py-4 bg-white border-b border-neutral-200 md:sticky md:top-[73px] md:z-30">
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
            {text.shuttleTab}
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
            {text.publicTransitTab}
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
