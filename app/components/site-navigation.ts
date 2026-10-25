import type { Dictionary } from "@/lib/i18n";

export function getPrimaryNavigation(dictionary: Dictionary) {
  return [
    { path: "/", icon: "home-outline", label: dictionary.navigation.home },
    { path: "/academic", icon: "book-open", label: dictionary.navigation.academic },
    { path: "/campus", icon: "map-pin", label: dictionary.navigation.campus },
    { path: "/more", icon: "more-horizontal", label: dictionary.navigation.more },
  ] as const;
}
