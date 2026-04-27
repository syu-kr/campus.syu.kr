import { NextResponse } from "next/server";
import { fetchPublicTransitArrivals } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 4개 정류장 도착 정보 병렬 조회
    const arrivals = await fetchPublicTransitArrivals();

    return NextResponse.json({
      success: true,
      data: arrivals,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to fetch public transit arrivals:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch data",
        data: [],
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
