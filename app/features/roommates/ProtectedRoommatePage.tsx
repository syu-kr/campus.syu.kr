import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { Container } from "@/app/components/Container";
import { LOCALE_HEADER_NAME, localizePath, normalizeLocale } from "@/lib/i18n";
import { getRoommateText } from "@/lib/i18n/roommates";
import { areRoommatesEnabled, ROOMMATE_SESSION_COOKIE } from "@/lib/roommates";
import RoommateSession from "./RoommateSession";
import RoommateLogout from "./RoommateLogout";

export default async function ProtectedRoommatePage({ children, path }: { children: React.ReactNode; path: string }) {
  const locale = normalizeLocale((await headers()).get(LOCALE_HEADER_NAME));
  if (!areRoommatesEnabled()) {
    return <Container className="py-8"><div className="mb-4 flex justify-end"><RoommateLogout /></div><p role="status" className="rounded-xl border border-neutral-200 bg-white p-6">{getRoommateText(locale).unavailable}</p></Container>;
  }
  if (!(await cookies()).get(ROOMMATE_SESSION_COOKIE)?.value) {
    redirect(`${localizePath("/campus/roommates/verify", locale)}?next=${encodeURIComponent(localizePath(path, locale))}`);
  }
  // The cookie is only a routing hint. No private children mount until auth/session
  // validates the current session; each data API also verifies it independently.
  return <Container className="py-6 sm:py-8"><RoommateSession>{children}</RoommateSession></Container>;
}
