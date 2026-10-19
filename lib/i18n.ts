import { koDictionary } from "./i18n/ko";
import { enDictionary } from "./i18n/en";
import type { Locale } from "./i18n/routing";

export * from "./i18n/routing";

export const dictionaries = { ko: koDictionary, en: enDictionary } as const;

export type Dictionary = (typeof dictionaries)[Locale];

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
