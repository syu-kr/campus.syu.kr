import { NextResponse } from "next/server";
import { isDailyCrawlDataFile } from "@/lib/crawl-data-contract";
import { readDailyCrawlDataSnapshot } from "@/lib/server/crawl-data";
import { parsePublicHolidaySnapshot } from "@/lib/public-holidays";
import type { CafeteriaMenuPayload } from "@/lib/cafeteria";

export const runtime = "nodejs";

interface RouteContext {
  params: Promise<{
    fileName: string;
  }>;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { fileName } = await params;
  if (!isDailyCrawlDataFile(fileName)) {
    return NextResponse.json(
      { error: "지원하지 않는 크롤링 데이터 파일입니다." },
      { status: 404 },
    );
  }

  try {
    const snapshot = await readDailyCrawlDataSnapshot<unknown>(fileName);

    let data = fileName === "public-holidays.json" ? {
      ...parsePublicHolidaySnapshot(snapshot.data),
      stale: snapshot.source === "bundled-fallback" || snapshot.sourceHealth?.status === "stale",
    } : snapshot.data;
    if (fileName === "cafeteria-menu.json") {
      const cafeteria = snapshot.data as CafeteriaMenuPayload;
      const metadata = {
        checkedAt: snapshot.source === "bundled-fallback" ? null : snapshot.sourceHealth?.lastSuccessAt ?? null,
        stale: snapshot.source === "bundled-fallback" || snapshot.sourceHealth?.status === "stale",
      };
      data = Array.isArray(cafeteria)
        ? cafeteria.map((entry) => ({ ...entry, ...metadata }))
        : { ...cafeteria, ...metadata };
    }
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        "X-Crawl-Data-Source": snapshot.source,
        "X-Crawl-Data-Version": snapshot.version,
      },
    });
  } catch (error) {
    console.error(`[crawl-data] ${fileName} API 응답 생성 실패:`, error);
    return NextResponse.json(
      { error: "크롤링 데이터를 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
