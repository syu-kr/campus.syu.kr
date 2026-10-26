import { createHash } from "node:crypto";
import { isPublicDataFile } from "@/lib/public-data-snapshot";
import { readPublicDataBundle } from "@/lib/server/public-data";

export const runtime = "nodejs";
export async function GET(request: Request, { params }: { params: Promise<{ fileName: string }> }) {
  const { fileName } = await params;
  if (!isPublicDataFile(fileName)) return Response.json({ error: "정보를 찾을 수 없습니다." }, { status: 404 });
  try {
    const snapshot = await readPublicDataBundle([fileName]);
    const json = JSON.stringify(snapshot.data[fileName]);
    const etag = `"${createHash("sha256").update(json).digest("hex")}"`;
    const headers = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=60, stale-while-revalidate=300", "X-Public-Data-Source": snapshot.source, "X-Public-Data-Version": snapshot.version, ETag: etag };
    if (request.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
    return new Response(json, { headers });
  } catch { return Response.json({ error: "정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
}
