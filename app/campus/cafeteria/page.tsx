import { CafeteriaPageClient } from "@/app/features/cafeteria/CafeteriaPageClient";
import { getKoreaNow } from "@/lib/home";
import { getHomeCafeteriaSnapshot } from "@/lib/server/home-data";
import { publicDataFirebaseEnabled } from "@/lib/server/public-data-storage";

export default async function CafeteriaPage() {
  const initialSnapshot = await getHomeCafeteriaSnapshot();
  const now = getKoreaNow();

  return (
    <CafeteriaPageClient
      initialSnapshot={initialSnapshot}
      initialNowIso={now.toISOString()}
      firebaseDataEnabled={publicDataFirebaseEnabled()}
    />
  );
}
