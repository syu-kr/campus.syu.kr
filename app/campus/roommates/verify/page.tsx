import RoommateVerify from "@/app/features/roommates/RoommateVerify";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { LOCALE_HEADER_NAME, normalizeLocale } from "@/lib/i18n";
import { getRoommatePageSession } from "@/lib/server/roommate-auth";
import { safeRoommatePath } from "@/app/features/roommates/client";

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const locale = normalizeLocale((await headers()).get(LOCALE_HEADER_NAME));
  const { next } = await searchParams;
  let verified = false;
  try { await getRoommatePageSession(); verified = true; } catch { /* Public verification remains available for an expired session. */ }
  if (verified) redirect(safeRoommatePath(next, locale));
  return <RoommateVerify />;
}
