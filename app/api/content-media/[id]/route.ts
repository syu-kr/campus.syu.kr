import { MANAGED_MEDIA_CACHE_CONTROL, readManagedImage } from "@/lib/server/managed-media";
import { ApiError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const ifNoneMatch = req.headers.get("if-none-match");
    const image = await readManagedImage((await context.params).id, ifNoneMatch);
    const headers = { "Content-Type": "image/webp", "Cache-Control": MANAGED_MEDIA_CACHE_CONTROL, "X-Content-Type-Options": "nosniff", ETag: image.etag };
    if (image.data === null || ifNoneMatch === image.etag) return new Response(null, { status: 304, headers });
    return new Response(new Uint8Array(image.data), { headers });
  } catch (error) {
    return Response.json({ error: "이미지를 불러올 수 없습니다." }, { status: error instanceof ApiError ? error.status : 503, headers: { "Cache-Control": "no-store" } });
  }
}
