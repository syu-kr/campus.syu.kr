import { getAllServiceNotices } from "@/lib/serviceNotices";
import { normalizeLocale } from "@/lib/i18n/routing";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const locale = normalizeLocale(new URL(req.url).searchParams.get("locale"));
  try {
    const serviceNotices = await getAllServiceNotices(locale);
    return Response.json(serviceNotices, { headers: { "Content-Language": locale, "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Failed to fetch service notices:", error);
    return Response.json({ error: "서비스 공지를 불러오지 못했습니다." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
