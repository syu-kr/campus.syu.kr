import { getActivePublicData, publicDataFirebaseEnabled } from "@/lib/server/public-data-storage";
export const runtime = "nodejs";
export async function GET() {
  if (!publicDataFirebaseEnabled()) return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const active = await getActivePublicData();
    return Response.json(active.manifest, { headers: { "Cache-Control": "no-store", "X-Public-Data-Source": "firebase-storage" } });
  } catch { return Response.json({ error: "Public data unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
