"use client";

import clsx from "clsx";
import dynamic from "next/dynamic";
import { useState } from "react";

import {
  AnswerSummaryCard,
  type AnswerSummary,
} from "@/app/components/AnswerSummaryCard";
import { Container } from "@/app/components/Container";
import { SourceTrustPanel } from "@/app/components/SourceTrustPanel";
import { useDictionary } from "@/app/components/LocaleProvider";
import PublicTransitSection from "./PublicTransitSection";

function ShuttleSectionLoading() {
  const dictionary = useDictionary();

  return <div className="py-8">{dictionary.pages.busInfo.loading}</div>;
}

const ShuttleSection = dynamic(() => import("./ShuttleSection"), {
  loading: () => <ShuttleSectionLoading />,
});

export default function BusInfoPageClient({
  shuttleAnswerSummary,
}: {
  shuttleAnswerSummary: AnswerSummary;
}) {
  const dictionary = useDictionary();
  const text = dictionary.pages.busInfo;
  const trustText = dictionary.trust;
  const [activeTab, setActiveTab] = useState<"shuttle" | "public-transit">(
    "shuttle",
  );

  return (
    <>
      <Container className="py-5 sm:py-6">
        <div className="space-y-4">
          <AnswerSummaryCard summary={shuttleAnswerSummary} />
          <SourceTrustPanel
            badges={[
              { color: "yellow", label: trustText.unofficialBadge },
              { color: "blue", label: trustText.sourceBasedBadge },
            ]}
            description={trustText.description}
            items={[
              {
                label: trustText.serviceStatusLabel,
                value: trustText.serviceStatusValue,
              },
              {
                label: trustText.sourceLabel,
                value: shuttleAnswerSummary.source,
              },
              {
                label: trustText.updatedLabel,
                value: shuttleAnswerSummary.updatedAt,
              },
            ]}
            note={trustText.note}
            title={trustText.title}
          />
        </div>
      </Container>

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
