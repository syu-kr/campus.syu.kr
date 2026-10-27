import { readManagedImage } from "@/lib/server/managed-media";
import { ApiError } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const image = await readManagedImage((await context.params).id);
    const headers = { "Content-Type": "image/webp", "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff", ETag: image.etag };
    if (req.headers.get("if-none-match") === image.etag) return new Response(null, { status: 304, headers });
    return new Response(new Uint8Array(image.data), { headers });
  } catch (error) {
    return Response.json({ error: "이미지를 불러올 수 없습니다." }, { status: error instanceof ApiError ? error.status : 503, headers: { "Cache-Control": "no-store" } });
  }
}
