import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Container } from "@/app/components/Container";
import { LOCALE_HEADER_NAME, localizePath, normalizeLocale } from "@/lib/i18n";
import { getRoommateText } from "@/lib/i18n/roommates";
import { getRoommatePageSession } from "@/lib/server/roommate-auth";
import { RoommateError } from "@/lib/roommates";
import RoommateSession from "./RoommateSession";
import RoommateLogout from "./RoommateLogout";

export default async function ProtectedRoommatePage({ children, path }: { children: React.ReactNode; path: string }) {
  const locale = normalizeLocale((await headers()).get(LOCALE_HEADER_NAME));
  let expiresAt: string;
  let sessionTag: string | undefined;
  try { const session = await getRoommatePageSession(); expiresAt = session.expiresAt; sessionTag = (session as { sessionTag?: string }).sessionTag; }
  catch (error) {
    if (error instanceof RoommateError && error.status === 401) redirect(`${localizePath("/campus/roommates/verify", locale)}?next=${encodeURIComponent(localizePath(path, locale))}`);
    return <Container className="py-8"><div className="mb-4 flex justify-end"><RoommateLogout /></div><p role="status" className="rounded-xl border border-neutral-200 bg-white p-6">{getRoommateText(locale).unavailable}</p></Container>;
  }
  return <Container className="py-6 sm:py-8"><RoommateSession expiresAt={expiresAt} sessionTag={sessionTag}>{children}</RoommateSession></Container>;
}
