import { handleShuttleEta } from "@/lib/server/shuttle-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req?: Request) {
  return handleShuttleEta(req, true);
}
