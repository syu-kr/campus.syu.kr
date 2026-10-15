import { headers } from "next/headers";

import { CafeteriaPageClient } from "@/app/features/cafeteria/CafeteriaPageClient";
import { getKoreaNow } from "@/lib/home";
import { getHomeCafeteriaSnapshot } from "@/lib/server/home-data";

const CSP_NONCE_HEADER_NAME = "x-csp-nonce";

export default async function CafeteriaPage() {
  const headerStore = await headers();
  const nonce = headerStore.get(CSP_NONCE_HEADER_NAME) || undefined;
  const initialSnapshot = await getHomeCafeteriaSnapshot();
  const now = getKoreaNow();

  return (
    <CafeteriaPageClient
      initialSnapshot={initialSnapshot}
      initialNowIso={now.toISOString()}
      nonce={nonce}
    />
  );
}
