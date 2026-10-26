import { ManagedBanners } from "./ManagedBanners";
import { getPublicBanners } from "@/lib/server/public-managed-content";
import type { PublicBanner } from "@/types/managed-content";
import { getKoreaNow } from "@/lib/home";

export async function ManagedBannerPlacement({ placement }: { placement: PublicBanner["placement"] }) {
  const now = getKoreaNow().getTime();
  return <ManagedBanners placement={placement} initialBanners={await getPublicBanners(placement, now)} initialNow={now} />;
}
