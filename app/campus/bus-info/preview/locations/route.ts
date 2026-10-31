import { requireAdmin, AdminAuthError } from "@/lib/server/admin-auth";
import { pilotPositions, pilotWeekend } from "@/lib/server/shuttle-pilot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex" };
function failure(status = 503) { return Response.json({ success:false, data:[] }, {status, headers}); }
export async function GET() {
  try { return Response.json(await pilotPositions(false), {headers}); } catch { return failure(); }
}
export async function POST(req: Request) {
  // Weekend short circuit precedes auth, GPS, calendar reads and Firestore access.
  if (pilotWeekend(new Date())) return Response.json({collection:"closed"}, {headers});
  try {
    await requireAdmin(req);
    const {collection, timestamp, data} = await pilotPositions(true);
    return Response.json({collection, receiptAt:timestamp, vehicles:data.length}, {headers});
  } catch (error) { return failure(error instanceof AdminAuthError ? error.status : 503); }
}
