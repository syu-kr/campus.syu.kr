import { unstable_cache } from "next/cache";
import { createHash } from "node:crypto";
import type { PublicManagedContentMetadata, PublicManagedPublication, PublicBanner } from "@/types/managed-content";

export const PUBLIC_MANAGED_CONTENT_TAG = "site-managed-content-v2";

const readCachedRecords = unstable_cache(async () => {
  const { readPublishedManagedContentRecords } = await import("./managed-content");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      readPublishedManagedContentRecords(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Published content could not be loaded")), 4500); }),
    ]);
  } finally { clearTimeout(timer); }
}, [PUBLIC_MANAGED_CONTENT_TAG], { tags: [PUBLIC_MANAGED_CONTENT_TAG], revalidate: 30 });

export async function getPublicManagedContentRecords(): Promise<PublicManagedContentMetadata[]> {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return [];
  return readCachedRecords();
}

export async function getPublicManagedContentRecord(id: string): Promise<PublicManagedPublication | null> {
  if (!process.env.FIREBASE_SERVICE_ACCOUNT) return null;
  const { readPublishedManagedContentRecord } = await import("./managed-content");
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      readPublishedManagedContentRecord(id),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Published content could not be loaded")), 4500); }),
    ]);
  } finally { clearTimeout(timer); }
}

export function isVisiblePublication(record: { archived: boolean; published: { startsAt: string | null; endsAt: string | null } | null }, now = Date.now()) {
  const publication = record.published;
  if (record.archived || !publication) return false;
  const starts = publication.startsAt ? Date.parse(publication.startsAt) : -Infinity;
  const ends = publication.endsAt ? Date.parse(publication.endsAt) : Infinity;
  return starts <= now && now < ends;
}

export async function getPublicBanners(placement: PublicBanner["placement"], now = Date.now()): Promise<PublicBanner[]> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const records = await Promise.race([
      getPublicManagedContentRecords(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Banner read timed out")), 1000); }),
    ]);
    return records
      .filter(record => record.published?.kind === "banner" && isVisiblePublication(record, now))
      .flatMap(record => record.published?.kind === "banner" && record.published.placement === placement
        ? [{ ...record.published, id: record.id, revision: record.publishedRevision ?? parseInt(createHash("sha256").update(JSON.stringify(record.published)).digest("hex").slice(0, 8), 16) }] : [])
      .sort((a, b) => b.priority - a.priority || a.id.localeCompare(b.id, "en"))
      .slice(0, 3);
  } catch {
    // A banner outage must not block campus services or reveal cached draft content.
    return [];
  } finally { clearTimeout(timer); }
}
