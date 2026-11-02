import { handleShuttleLocations } from "@/lib/server/shuttle-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handleShuttleLocations(true);
}
