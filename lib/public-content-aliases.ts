import type { Locale } from "./i18n/routing";

const names: Record<string, string> = {
  화랑대역: "Hwarangdae Station", 석계역: "Seokgye Station", 별내역: "Byeollae Station",
  화랑대: "Hwarangdae", 석계: "Seokgye", 별내: "Byeollae", 구리: "Guri",
  학교: "Campus", 캠퍼스: "Campus", 열람실: "Reading Room", 집중실: "Focus Room",
};

/** Display aliases only; source identifiers, search values and seat-map ordering stay unchanged. */
export function getPublicContentAlias(value: string, locale: Locale): string {
  if (locale !== "en") return value;
  if (names[value]) return names[value];
  if (/^제[12]자료실[AB]$/.test(value)) return value.replace(/^제([12])자료실([AB])$/, "Collection Room $1$2");
  if (/^[1-9]층 집중실$/.test(value)) return value.replace(/^([1-9])층 집중실$/, "$1F Focus Room");
  if (!/(?:화랑대|석계|별내|학교|캠퍼스)/.test(value)) return value;
  // Longer station names must match before their shorter place aliases.
  return value.replace(/(?<![가-힣])(?:화랑대역|석계역|별내역|화랑대|석계|별내|학교|캠퍼스)(?![가-힣])/g, name => names[name])
    .replace(/\(?([1-9]\d*)번\s*출구\)?/g, "(Exit $1)")
    .replace(/(\S)\(Exit/g, "$1 (Exit");
}
