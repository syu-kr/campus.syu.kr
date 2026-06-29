import { headers } from "next/headers";
import { permanentRedirect } from "next/navigation";
import {
  LOCALE_HEADER_NAME,
  localizePath,
  normalizeLocale,
} from "@/lib/i18n";

export default async function MoreCampusTipsRedirectPage() {
  const headerStore = await headers();
  const locale = normalizeLocale(headerStore.get(LOCALE_HEADER_NAME));

  permanentRedirect(localizePath("/campus/campus-tips", locale));
}
