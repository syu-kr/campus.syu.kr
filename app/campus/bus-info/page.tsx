import BusInfoPageClient from "@/app/campus/bus-info/BusInfoPageClient";
import ShuttleServicePreview from "./preview/ShuttleServicePreview";
import { loadShuttleServiceData } from "@/lib/server/shuttle-service-data";
import "./preview/preview.css";

export default async function BusInfoPage() {
  const data = await loadShuttleServiceData();
  return (
    <BusInfoPageClient
      shuttleContent={<ShuttleServicePreview data={data} surface="production" />}
    />
  );
}
