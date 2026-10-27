import { getPublicBanners } from "@/lib/server/public-managed-content";

export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const placement = new URL(req.url).searchParams.get("placement");
  if (placement !== "home" && placement !== "site-top" && placement !== "popup") return Response.json({ error: "Unknown placement" }, { status: 400 });
  return Response.json({ banners: await getPublicBanners(placement) }, { headers: { "Cache-Control": "no-store" } });
}
