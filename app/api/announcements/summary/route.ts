import { NextResponse } from "next/server";
import { getAnnouncementSummary } from "@/lib/server/announcements";

export const runtime = "nodejs";

export async function GET() {
  try {
    const data = await getAnnouncementSummary(12);

    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch {
    return NextResponse.json([], {
      headers: {
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    });
  }
}
