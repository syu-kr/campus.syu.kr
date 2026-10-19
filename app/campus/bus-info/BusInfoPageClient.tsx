"use client";

import clsx from "clsx";
import { useState } from "react";

import { Container } from "@/app/components/Container";
import { useDictionary } from "@/app/components/LocaleProvider";
import PublicTransitSection from "./PublicTransitSection";
import ShuttleSection from "./ShuttleSection";
import type { ShuttleInitialData } from "./ShuttleSection";

export default function BusInfoPageClient({ initialData }: { initialData: ShuttleInitialData }) {
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
            type="button"
            onClick={() => setActiveTab("shuttle")}
            aria-pressed={activeTab === "shuttle"}
            className={clsx(
              "min-h-11 flex-1 px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition-all",
              activeTab === "shuttle"
                ? "bg-blue-600 text-white shadow-md"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
            )}
          >
            {text.shuttleTab}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("public-transit")}
            aria-pressed={activeTab === "public-transit"}
            className={clsx(
              "min-h-11 flex-1 px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition-all",
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
        {activeTab === "shuttle" && <ShuttleSection initialData={initialData} />}
        {activeTab === "public-transit" && <PublicTransitSection />}
      </div>
    </>
  );
}
