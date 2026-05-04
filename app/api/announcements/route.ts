import { NextRequest, NextResponse } from "next/server";
import { getAnnouncementPage } from "@/lib/server/announcements";
import type { AnnouncementCategory } from "@/types";

export const runtime = "nodejs";

const VALID_CATEGORIES = new Set<AnnouncementCategory | "all">([
  "all",
  "academic",
  "campus",
  "scholarship",
]);

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const categoryParam = searchParams.get("category") || "all";
  const category = VALID_CATEGORIES.has(
    categoryParam as AnnouncementCategory | "all",
  )
    ? (categoryParam as AnnouncementCategory | "all")
    : "all";

  const page = Number(searchParams.get("page") || 1);
  const limit = Number(searchParams.get("limit") || 10);
  const query = searchParams.get("query") || "";

  const result = await getAnnouncementPage({
    category,
    query,
    page,
    limit,
  });

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": query
        ? "no-store"
        : "public, s-maxage=300, stale-while-revalidate=600",
    },
  });
}
