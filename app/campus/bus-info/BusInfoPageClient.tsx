"use client";

import { usePathname, useSearchParams } from "next/navigation";

import { Container } from "@/app/components/Container";
import { useDictionary } from "@/app/components/LocaleProvider";
import PublicTransitSection from "./PublicTransitSection";
import ShuttleSection from "./ShuttleSection";
import type { ShuttleInitialData } from "./ShuttleSection";

export default function BusInfoPageClient({ initialData }: { initialData: ShuttleInitialData }) {
  const dictionary = useDictionary();
  const text = dictionary.pages.busInfo;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") === "public-transit" ? "public-transit" : "shuttle";
  const setActiveTab = (tab: "shuttle" | "public-transit") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    window.history.replaceState(null, "", `${pathname}?${params}${window.location.hash}`);
  };

  return (
    <>
      <Container className="py-3 sm:py-4 bg-white border-b border-neutral-200 md:sticky md:top-[73px] md:z-30">
        <div className="m3-bus-tabs m3-segmented" data-selected-index={activeTab === "public-transit" ? 1 : 0} role="group" aria-label={dictionary.campus.menus.busTitle}>
          <button
            type="button"
            onClick={() => setActiveTab("shuttle")}
            aria-pressed={activeTab === "shuttle"}
            aria-controls="m3-bus-panel"
            className="m3-segmented-option"
          >
            {text.shuttleTab}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("public-transit")}
            aria-pressed={activeTab === "public-transit"}
            aria-controls="m3-bus-panel"
            className="m3-segmented-option"
          >
            {text.publicTransitTab}
          </button>
        </div>
      </Container>

      <div id="m3-bus-panel" role="region" aria-label={activeTab === "shuttle" ? text.shuttleTab : text.publicTransitTab}>
        {activeTab === "shuttle" && <ShuttleSection initialData={initialData} />}
        {activeTab === "public-transit" && <PublicTransitSection />}
      </div>
    </>
  );
}
