import { checkRateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { hasUispAnnouncement } from "@/lib/server/announcements";
import { getUispPostId, readUispAsset } from "@/lib/server/uisp-notices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 45;

export async function GET(request: Request, context: { params: Promise<{ id: string; kind: string; index: string }> }) {
  const { id, kind, index } = await context.params;
  const postId = getUispPostId(id);
  const headers = { "Cache-Control": "no-store" };
  if (!postId || (kind !== "attachment" && kind !== "image") || !/^(0|[1-9][0-9]{0,2})$/.test(index)) {
    return new Response(null, { status: 404, headers });
  }
  const limit = checkRateLimit(getRateLimitKey(request, "uisp-asset"), { limit: 60, windowMs: 60_000 });
  if (!limit.allowed) {
    return new Response(null, { status: 429, headers: { ...headers, "Retry-After": String(limit.retryAfterSeconds) } });
  }
  try {
    if (await hasUispAnnouncement(id)) {
      const asset = await readUispAsset(postId, kind, index, request.signal);
      if (asset) return asset;
    }
    return new Response(null, { status: 404, headers });
  } catch {
    return new Response(null, { status: 502, headers });
  }
}
