import { NextRequest, NextResponse } from "next/server";
import { getCompetitionPage } from "@/lib/server/competitions";
import type {
  CompetitionSourceFilter,
  CompetitionStatusFilter,
} from "@/types";

export const runtime = "nodejs";

const VALID_SOURCES = new Set<CompetitionSourceFilter>([
  "all",
  "academic",
  "campus",
  "scholarship",
  "event",
  "department",
]);

const VALID_STATUSES = new Set<CompetitionStatusFilter>([
  "all",
  "open",
  "result",
  "closed",
]);

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const sourceParam = searchParams.get("source") || "all";
  const statusParam = searchParams.get("status") || "open";
  const source = VALID_SOURCES.has(sourceParam as CompetitionSourceFilter)
    ? (sourceParam as CompetitionSourceFilter)
    : "all";
  const status = VALID_STATUSES.has(statusParam as CompetitionStatusFilter)
    ? (statusParam as CompetitionStatusFilter)
    : "open";
  const page = readPositiveInteger(searchParams.get("page"), 1);
  const limit = readPositiveInteger(searchParams.get("limit"), 10);
  const query = (searchParams.get("query") || "").slice(0, 100);

  const result = await getCompetitionPage({
    source,
    status,
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

function readPositiveInteger(value: string | null, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}
