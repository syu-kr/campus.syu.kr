import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { requireAdmin, AdminAuthError } from "@/lib/server/admin-auth";
import { ApiError, enforceRateLimit, readJsonBody } from "@/lib/server/http";
import { getRepositoryManagedContent } from "@/lib/serviceNotices";
import { readManagedContentRecords, requireManagedContentConfigured, mutateManagedContent, parseContentMutation } from "@/lib/server/managed-content";
import { PUBLIC_MANAGED_CONTENT_TAG } from "@/lib/server/public-managed-content";
import { isManagedMediaAvailable } from "@/lib/server/managed-media";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };

function failure(error: unknown) {
  if (error instanceof AdminAuthError || error instanceof ApiError) return NextResponse.json({ error: error.message, ...(error instanceof ApiError ? { code: error.code, field: error.field } : {}) }, { status: error.status, headers });
  return NextResponse.json({ error: "처리 결과를 확인하지 못했습니다. 목록을 새로 불러온 뒤 확인해 주세요.", code: "CONTENT_REQUEST_FAILED" }, { status: 503, headers });
}

export async function GET(req: Request) {
  try {
    await requireAdmin(req);
    requireManagedContentConfigured();
    await enforceRateLimit(req, "admin-content-read", { limit: 120, windowMs: 60_000 });
    const [seeds, stored, mediaAvailable] = await Promise.all([getRepositoryManagedContent(), readManagedContentRecords(), isManagedMediaAvailable()]);
    const items = new Map(seeds.map(item => [item.id, item]));
    stored.forEach(item => items.set(item.id, item));
    return NextResponse.json({ items: [...items.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), mediaAvailable }, { headers });
  } catch (error) { return failure(error); }
}

export async function POST(req: Request) {
  try {
    await requireAdmin(req);
    requireManagedContentConfigured();
    const mutation = parseContentMutation(await readJsonBody(req, 384 * 1024));
    await enforceRateLimit(req, "admin-content-write", { limit: 30, windowMs: 60_000 });
    const seeds = await getRepositoryManagedContent();
    const item = await mutateManagedContent(mutation, seeds.find(seed => seed.id === mutation.id));
    if (["publish", "unpublish", "archive"].includes(mutation.action)) {
      revalidateTag(PUBLIC_MANAGED_CONTENT_TAG, { expire: 0 });
      revalidatePath("/", "layout");
      revalidatePath("/service/notices");
      revalidatePath(`/service/notices/${item.id}`);
      revalidatePath("/api/service-notices");
      revalidatePath("/sitemap.xml");
    }
    return NextResponse.json({ item }, { headers });
  } catch (error) { return failure(error); }
}
