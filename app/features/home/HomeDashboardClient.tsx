"use client";

import dynamic from "next/dynamic";

export const HomeDashboardClient = dynamic(() =>
  import("./HomePageClient").then((module) => module.HomePageClient),
);
