import { requireAdmin, AdminAuthError } from "@/lib/server/admin-auth";
import { pilotPositions, pilotWeekend, readPilotFieldEvent } from "@/lib/server/shuttle-pilot";
import { ApiError, readJsonBody } from "@/lib/server/http";
import { handleShuttleLocations } from "@/lib/server/shuttle-handlers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };
function failure(status = 503) { return Response.json({ success:false, data:[] }, {status, headers}); }
export async function GET() {
  return handleShuttleLocations();
}
export async function POST(req: Request) {
  // Weekend short circuit precedes auth, GPS, calendar reads and Firestore access.
  if (pilotWeekend(new Date())) return Response.json({collection:"closed"}, {headers});
  try {
    await requireAdmin(req);
    // Next may represent a bodyless POST as a non-null empty stream.
    const body = await readJsonBody(req, 2048, true);
    if (body !== undefined && (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).length !== 1 || !("event" in body))) throw new ApiError("현장 기록 요청이 올바르지 않습니다");
    const field = body && typeof body === "object" && "event" in body ? readPilotFieldEvent(body.event) : undefined;
    const {collection, timestamp, data} = await pilotPositions(true, field);
    return Response.json({collection, receiptAt:timestamp, vehicles:data.length}, {headers});
  } catch (error) { return failure(error instanceof AdminAuthError || error instanceof ApiError ? error.status : 503); }
}
