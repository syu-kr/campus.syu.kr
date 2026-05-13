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
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <Skeleton height="240px" />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(320px,420px)_1fr]">
        <Skeleton count={3} height="120px" />
        <Skeleton height="520px" />
      </div>
    </div>
  );
}
