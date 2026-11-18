import { headers } from "next/headers";

import PhonePageClient from "@/app/features/phone/PhonePageClient";
import { getHomePhoneNumbers } from "@/lib/server/home-data";

const CSP_NONCE_HEADER_NAME = "x-csp-nonce";

export async function PhonePage() {
  const headerStore = await headers();
  const nonce = headerStore.get(CSP_NONCE_HEADER_NAME) || undefined;
  const initialPhoneNumbers = await getHomePhoneNumbers();
  return (
    <PhonePageClient initialPhoneNumbers={initialPhoneNumbers} nonce={nonce} />
  );
}
