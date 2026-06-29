import { getDictionary, type Locale } from "@/lib/i18n";

const SITE_ORIGIN = "https://campus.syu.kr";
const SITE_NAME = "SYU CAMPUS";
const PUBLISHER_NAME = "SYU KR";
const GITHUB_REPOSITORY_URL = "https://github.com/syu-kr/campus.syu.kr";
const SAHMYOOK_UNIVERSITY_URL = "https://www.syu.ac.kr/";

const SCHEMA_CONTEXT = "https://schema.org";
const WEBSITE_SCHEMA_ID = `${SITE_ORIGIN}/#website`;
const PUBLISHER_SCHEMA_ID = `${SITE_ORIGIN}/#publisher`;

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

export type ArticleSchemaInput = {
  authorName: string;
  datePublished?: string;
  description: string;
  headline: string;
  inLanguage: string;
  keywords?: string[];
  url: string;
};

function createWebSiteSchema(
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
    isAccessibleForFree: true,
    publisher: {
      "@id": PUBLISHER_SCHEMA_ID,
    },
    sameAs: [GITHUB_REPOSITORY_URL],
  };
}

export function createSiteIdentitySchema(locale: Locale): JsonLdValue {
  const dictionary = getDictionary(locale);
  const website = createWebSiteSchema(locale);

  return {
    "@context": SCHEMA_CONTEXT,
    "@graph": [
      {
        "@type": "Organization",
        "@id": PUBLISHER_SCHEMA_ID,
        name: PUBLISHER_NAME,
        url: SITE_ORIGIN,
        description: dictionary.meta.publisherDescription,
        sameAs: [GITHUB_REPOSITORY_URL],
        knowsAbout: [
          "Sahmyook University campus information",
          "Sahmyook University academic schedule",
          "Sahmyook University shuttle and cafeteria information",
        ],
      },
      {
        ...website,
        "@context": undefined,
        about: {
          "@type": "CollegeOrUniversity",
          name: "Sahmyook University",
          url: SAHMYOOK_UNIVERSITY_URL,
        },
        isBasedOn: [
          {
            "@type": "WebSite",
            name: "Sahmyook University",
            url: SAHMYOOK_UNIVERSITY_URL,
          },
          {
            "@type": "WebSite",
            name: "SYU CAMPUS GitHub repository",
            url: GITHUB_REPOSITORY_URL,
          },
        ],
      },
    ],
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

export function createArticleSchema({
  authorName,
  datePublished,
  description,
  headline,
  inLanguage,
  keywords,
  url,
}: ArticleSchemaInput): SchemaOrgDocument<SchemaOrgNode> {
  return {
    "@context": SCHEMA_CONTEXT,
    "@type": "Article",
    headline,
    description,
    url,
    inLanguage,
    ...(datePublished ? { datePublished } : {}),
    author: {
      "@type": "Organization",
      name: authorName,
    },
    ...(keywords && keywords.length > 0 ? { keywords } : {}),
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
