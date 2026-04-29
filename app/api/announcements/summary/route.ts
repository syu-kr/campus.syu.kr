import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import type { Announcement, AnnouncementCategory } from "@/types";

export const runtime = "nodejs";

const SOURCES: Array<{
  fileName: string;
  category?: AnnouncementCategory;
}> = [
  { fileName: "announcements-academic.json" },
  { fileName: "announcements-scholarship.json", category: "scholarship" },
  { fileName: "announcements-campus-life.json", category: "campus" },
];

export async function GET() {
  try {
    const announcements = await Promise.all(
      SOURCES.map(({ fileName, category }) =>
        readAnnouncements(fileName, category),
      ),
    );

    const data = announcements
      .flat()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 12);

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

async function readAnnouncements(
  fileName: string,
  category?: AnnouncementCategory,
) {
  const filePath = path.join(process.cwd(), "public", "data", fileName);
  const content = await readFile(filePath, "utf8");
  const items = JSON.parse(content) as Announcement[];

  return items.slice(0, 20).map((item) => ({
    ...item,
    category: category ?? item.category,
    content: item.content ? item.content.slice(0, 240) : "",
  }));
}
