import type { Dictionary } from "@/lib/i18n";

export function getPrimaryNavigation(dictionary: Dictionary) {
  return [
    { path: "/", icon: "home-outline", label: dictionary.navigation.home },
    { path: "/academic", icon: "book-open", label: dictionary.navigation.academic },
    { path: "/campus", icon: "map-pin", label: dictionary.navigation.campus },
    { path: "/more", icon: "more-horizontal", label: dictionary.navigation.more },
  ] as const;
}

export function getDesktopNavigationGroups(dictionary: Dictionary, roommatesEnabled: boolean) {
  const [, academicNav, campusNav, moreNav] = getPrimaryNavigation(dictionary);
  const academic = dictionary.academic.menus;
  const campus = dictionary.campus.menus;
  const more = dictionary.more.menus;
  return [
    { ...academicNav, items: [
      { path: "/academic/announcements", label: academic.announcementsTitle, icon: "megaphone" },
      { path: "/academic/schedule", label: academic.scheduleTitle, icon: "calendar" },
      { path: "/academic/sw-notices", label: academic.swNoticesTitle, icon: "lightbulb" },
      { path: "/academic/competitions", label: academic.competitionsTitle, icon: "award" },
      { path: "/academic/scholarship", label: academic.scholarshipTitle, icon: "award" },
      { path: "/academic/graduation", label: academic.graduationTitle, icon: "check-circle" },
      { path: "/academic/timetable", label: academic.timetableTitle, icon: "calendar" },
      { path: "https://sugang.syu.kr/testLogin", label: academic.mockSugangTitle, icon: "book-open" },
      { path: "https://sugang.syu.kr/basket", label: academic.basketCompetitionTitle, icon: "bar-chart-3" },
    ] },
    { ...campusNav, items: [
      ...(roommatesEnabled ? [{ path: "/campus/roommates", label: campus.roommatesTitle, icon: "building" }] : []),
      { path: "/campus/announcements", label: campus.announcementsTitle, icon: "megaphone" },
      { path: "/campus/cafeteria", label: campus.cafeteriaTitle, icon: "utensils" },
      { path: "/campus/bus-info", label: campus.busTitle, icon: "bus" },
      { path: "/campus/library", label: campus.libraryTitle, icon: "book-open" },
      { path: "/campus/map", label: campus.mapTitle, icon: "map" },
      { path: "/campus/phone", label: campus.phoneTitle, icon: "phone" },
      { path: "/campus/campus-tips", label: campus.campusTipsTitle, icon: "lightbulb" },
      { path: "/campus/gym", label: campus.gymTitle, icon: "dumbbell" },
      { path: "/campus/health-center", label: campus.healthCenterTitle, icon: "stethoscope" },
    ] },
    { ...moreNav, items: [
      { path: "/service/notices", label: more.serviceTitle, icon: "megaphone" },
      { path: "/more/meet", label: more.meetTitle, icon: "calendar" },
      { path: "/more/privacy", label: more.privacyTitle, icon: "check-circle" },
    ] },
  ];
}
