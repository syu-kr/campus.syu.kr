import type { Metadata } from "next";
import BusInfoPageClient from "../BusInfoPageClient";
import ShuttleServicePreview from "./ShuttleServicePreview";
import { loadShuttleServiceData } from "./service-data.server";
import "./preview.css";

export const metadata: Metadata = {
  title: "Shuttle arrival preview | SYU CAMPUS",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default async function ShuttlePreviewPage({searchParams}:{searchParams:Promise<{scenario?:string|string[]}>}) {
  const operatingPreview=(await searchParams).scenario==="operating";
  const data=await loadShuttleServiceData(operatingPreview);
  return <BusInfoPageClient shuttleContent={<ShuttleServicePreview key={operatingPreview?"operating":"current"} data={data} operatingPreview={operatingPreview} />} />;
}
