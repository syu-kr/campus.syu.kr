import { NextResponse } from "next/server";
import * as fs from "fs/promises";
import * as path from "path";

export async function GET() {
  try {
    const publicDataDir = path.join(process.cwd(), "public/data");

    // 각 JSON 파일의 수정 시간 확인
    const files = [
      "announcements-academic.json",
      "announcements-scholarship.json",
      "announcements-campus-life.json",
      "cafeteria-menu.json",
      "graduation-requirements.json",
      "library-reading-rooms.json",
      "phone-numbers.json",
      "schedules-major.json",
      "shuttle-bus-schedule.json",
    ];

    const versions: Record<string, number> = {};

    for (const file of files) {
      try {
        const filePath = path.join(publicDataDir, file);
        const stat = await fs.stat(filePath);
        versions[file] = Math.floor(stat.mtimeMs); // 밀리초 단위 수정 시간
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (_error) {
        versions[file] = 0;
      }
    }

    return NextResponse.json(
      {
        versions,
        timestamp: Date.now(),
      },
      {
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  } catch (error) {
    console.error("[Version API] Error:", error);
    return NextResponse.json({ error: "버전 정보 조회 실패" }, { status: 500 });
  }
}
