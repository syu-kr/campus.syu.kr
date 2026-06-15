import { Suspense } from "react";

import { Skeleton } from "@/app/components/Skeleton";
import { TimetableBuilderClient } from "./TimetableBuilderClient";

export default function TimetableWizardPage() {
  return (
    <Suspense fallback={<TimetablePageFallback />}>
      <TimetableBuilderClient />
    </Suspense>
  );
}

function TimetablePageFallback() {
  return (
    <div className="mx-auto w-full max-w-[88rem] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Skeleton height="240px" />
      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_420px]">
        <Skeleton height="520px" />
        <Skeleton count={3} height="120px" />
      </div>
      <div className="mt-6">
        <Skeleton height="620px" />
      </div>
    </div>
  );
}
