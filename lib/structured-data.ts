import { getDictionary, type Locale } from "@/lib/i18n";

const SITE_ORIGIN = "https://campus.syu.kr";
const SITE_NAME = "SYU CAMPUS";

const SCHEMA_CONTEXT = "https://schema.org";
const WEBSITE_SCHEMA_ID = `${SITE_ORIGIN}/#website`;

type JsonLdPrimitive = string | number | boolean | null;
export type JsonLdValue = JsonLdPrimitive | JsonLdObject | JsonLdValue[];
type JsonLdObject = {
  [key: string]: JsonLdValue | undefined;
};

export type SchemaOrgNode = JsonLdObject & {
  "@type": string | string[];
};

export type SchemaOrgDocument<TNode extends SchemaOrgNode> = TNode & {
  "@context": typeof SCHEMA_CONTEXT;
};

export type FAQPageQuestion = {
  questionName: string;
  acceptedAnswerText: string;
};

export function createWebSiteSchema(
  locale: Locale,
): SchemaOrgDocument<SchemaOrgNode> {
  const dictionary = getDictionary(locale);

  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "WebSite",
    "@id": WEBSITE_SCHEMA_ID,
    name: SITE_NAME,
    url: SITE_ORIGIN,
    description: dictionary.meta.schemaDescription,
    inLanguage: dictionary.meta.inLanguage,
  };
}

export function createFAQPageSchema({
  mainEntity,
  inLanguage,
  url,
}: {
  mainEntity: FAQPageQuestion[];
  inLanguage: string;
  url?: string;
}): SchemaOrgDocument<SchemaOrgNode> {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "FAQPage",
    ...(url ? { url } : {}),
    inLanguage,
    mainEntity: mainEntity.map((item) => ({
      "@type": "Question",
      name: item.questionName,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.acceptedAnswerText,
      },
    })),
  };
}

export function serializeJsonLd(data: JsonLdValue): string {
  return JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
