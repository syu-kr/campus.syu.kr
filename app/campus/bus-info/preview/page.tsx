import type { Metadata } from "next";
import BusInfoPageClient from "../BusInfoPageClient";
import ShuttleServicePreview from "./ShuttleServicePreview";
import { loadShuttleServiceData } from "./service-data.server";
import "./preview.css";

export const metadata: Metadata = {
  title: "Shuttle arrival preview | SYU CAMPUS",
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default async function ShuttlePreviewPage({searchParams}:{searchParams:Promise<{scenario?:string|string[];view?:string|string[]}>}) {
  const query=await searchParams;
  const surface=query.view==="production"?"production":"preview";
  const operatingPreview=surface==="preview"&&query.scenario==="operating";
  const data=await loadShuttleServiceData(operatingPreview);
  return <BusInfoPageClient shuttleContent={<ShuttleServicePreview key={`${surface}:${operatingPreview?"operating":"current"}`} data={data} operatingPreview={operatingPreview} surface={surface} />} />;
}
