import { NextResponse } from "next/server";
import { AdminAuthError, requireAdmin } from "@/lib/server/admin-auth";
import { ApiError, enforceSameOrigin, enforceRateLimit } from "@/lib/server/http";
import { MAX_MEDIA_INPUT, saveManagedImage, isManagedMediaAvailable } from "@/lib/server/managed-media";
import { readResponseBytes } from "@/lib/server/read-response-bytes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  try {
    await requireAdmin(req);
    enforceSameOrigin(req);
    await enforceRateLimit(req, "admin-content-media", { limit: 10, windowMs: 60_000 });
    if (!await isManagedMediaAvailable()) throw new ApiError("이미지 저장소에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.", 503, "file", "MEDIA_UNAVAILABLE");
    if (!req.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data;")) throw new ApiError("이미지 파일을 선택해 주세요.", 415, "file");
    const bytes = await readResponseBytes(new Response(req.body, { headers: req.headers }), MAX_MEDIA_INPUT + 64 * 1024, "Media upload").catch(() => { throw new ApiError("이미지는 5MB 이하로 선택해 주세요.", 413, "file"); });
    const form = await new Response(bytes, { headers: { "content-type": req.headers.get("content-type")! } }).formData().catch(() => { throw new ApiError("이미지 파일을 확인해 주세요.", 400, "file"); });
    if ([...form.keys()].some(key => key !== "file") || form.getAll("file").length !== 1) throw new ApiError("이미지 한 개를 선택해 주세요.", 400, "file");
    const file = form.get("file");
    if (!file || typeof file === "string" || file.size === 0 || file.size > MAX_MEDIA_INPUT) throw new ApiError("이미지는 5MB 이하로 선택해 주세요.", 413, "file");
    return NextResponse.json(await saveManagedImage(new Uint8Array(await file.arrayBuffer())), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const known = error instanceof AdminAuthError || error instanceof ApiError;
    return NextResponse.json({ error: known ? error.message : "이미지 업로드 결과를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.", ...(error instanceof ApiError ? { field: error.field, code: error.code } : {}) }, { status: known ? error.status : 503, headers: { "Cache-Control": "private, no-store" } });
  }
}
