import { readPublicBanners } from "@/lib/server/public-managed-content";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const placement = new URL(req.url).searchParams.get("placement");
  if (placement !== "home" && placement !== "site-top" && placement !== "popup") return Response.json({ error: "Unknown placement" }, { status: 400 });
  try {
    return Response.json({ banners: await readPublicBanners(placement) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Banners unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
