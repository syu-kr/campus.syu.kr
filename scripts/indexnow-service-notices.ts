import { createHash } from "node:crypto";
import { readResponseBytes } from "../lib/server/read-response-bytes";
import { INDEXNOW_ORIGIN } from "./indexnow-submit";
import type { SnapshotFile } from "./indexnow-snapshot";

export const SERVICE_NOTICE_SNAPSHOT_KEY = "runtime/service-notices.json";
interface NoticeMetadata {
  id: string; slug: string; title: string; date: string; author: string; lang?: string;
  excerpt?: string; description?: string; modifiedAt?: string; startsAt?: string | null; endsAt?: string | null;
}
function notices(value: unknown): NoticeMetadata[] {
  if (!Array.isArray(value) || value.length > 500) throw new Error("Invalid public service notice index");
  const seen = new Set<string>();
  return value.map(item => {
    if (!item || typeof item !== "object" || !["id", "slug", "title", "date", "author"].every(key => typeof item[key] === "string" && item[key].length > 0) || !/^[A-Za-z0-9][A-Za-z0-9-]{0,119}$/.test(item.slug) || seen.has(item.slug) || !Number.isFinite(Date.parse(item.date))) throw new Error("Invalid public service notice metadata");
    seen.add(item.slug);
    for (const field of ["excerpt", "description", "modifiedAt", "lang"]) if (item[field] !== undefined && typeof item[field] !== "string") throw new Error("Invalid public service notice field");
    for (const field of ["startsAt", "endsAt"]) if (item[field] !== undefined && item[field] !== null && (typeof item[field] !== "string" || !Number.isFinite(Date.parse(item[field])))) throw new Error("Invalid public service notice window");
    return Object.fromEntries(["id", "slug", "title", "date", "author", "lang", "excerpt", "description", "modifiedAt", "startsAt", "endsAt"].filter(key => item[key] !== undefined).map(key => [key, item[key]])) as unknown as NoticeMetadata;
  }).sort((a, b) => a.slug.localeCompare(b.slug, "en-US"));
}
/** Read the same published metadata as the site, including CMS additions and removals. */
export async function collectServiceNoticeSnapshot(fetchImpl: typeof fetch = fetch): Promise<SnapshotFile> {
  const result: Record<string, NoticeMetadata[]> = {};
  for (const locale of ["ko", "en"]) {
    const response = await fetchImpl(`${INDEXNOW_ORIGIN}/api/service-notices?locale=${locale}`, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error("Published service notice index unavailable; refusing an empty baseline");
    result[locale] = notices(JSON.parse(new TextDecoder().decode(await readResponseBytes(response, 1024 * 1024, "Service notice index"))));
  }
  const identity = (rows: NoticeMetadata[]) => rows.map(({ id, slug, date, author, modifiedAt, startsAt, endsAt }) => ({ id, slug, date, author, modifiedAt, startsAt, endsAt }));
  if (JSON.stringify(identity(result.ko)) !== JSON.stringify(identity(result.en))) throw new Error("Service notices changed while collecting locales; retry with a fresh snapshot");
  return { hash: createHash("sha256").update(JSON.stringify(result)).digest("hex"), data: result };
}
