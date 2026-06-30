"use client";

import clsx from "clsx";
import dynamic from "next/dynamic";
import { useState } from "react";

import { Container } from "@/app/components/Container";
import { useDictionary } from "@/app/components/LocaleProvider";
import PublicTransitSection from "./PublicTransitSection";

function ShuttleSectionLoading() {
  const dictionary = useDictionary();

  return <div className="py-8">{dictionary.pages.busInfo.loading}</div>;
}

const ShuttleSection = dynamic(() => import("./ShuttleSection"), {
  loading: () => <ShuttleSectionLoading />,
});

export default function BusInfoPageClient() {
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
