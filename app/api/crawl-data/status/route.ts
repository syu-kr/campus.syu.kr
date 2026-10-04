import { NextResponse } from "next/server";
import { readDailyCrawlSourceHealth } from "@/lib/server/crawl-data";

export const runtime = "nodejs";

export async function GET() {
  try {
    const sourceHealth = await readDailyCrawlSourceHealth();
    return NextResponse.json({ sourceHealth }, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch {
    return NextResponse.json({ error: "Crawl status unavailable" }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
