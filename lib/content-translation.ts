export type ContentTranslationSource = {
  kind: "announcement" | "cafeteria" | "student-restaurant" | "schedule" | "competition" | "tip" | "service-notice" | "course" | "phone" | "shuttle" | "library" | "graduation" | "map" | "banner";
  id: string;
  category?: string;
};

export type PublicContentFields = Record<string, string>;

export function announcementTranslationFields(announcement: { title: string; aiSummary?: { summary: string; deadline?: string; requiredAction: string; target: string; keywords: string[] } }): PublicContentFields {
  const fields: PublicContentFields = { title: announcement.title };
  if (announcement.aiSummary) {
    for (const field of ["summary", "deadline", "requiredAction", "target"] as const) {
      const value = announcement.aiSummary[field];
      if (value?.trim() && value.trim().toLowerCase() !== "unknown") fields[`aiSummary.${field}`] = value;
    }
    announcement.aiSummary.keywords.forEach((keyword, index) => { fields[`aiSummary.keywords.${index}`] = keyword; });
  }
  return fields;
}

/** Preserve every source character while keeping individual provider fields bounded. */
export function splitPublicContentText(text: string, maxCharacters = 3000): string[] {
  const limit = Math.max(1, Math.min(3000, Math.floor(maxCharacters) || 3000));
  const characters = [...text];
  const parts: string[] = [];
  for (let index = 0; index < characters.length;) {
    let end = Math.min(index + limit, characters.length);
    if (end < characters.length) {
      for (let boundary = end; boundary > index + limit / 2; boundary -= 1) {
        if (/\s/.test(characters[boundary - 1])) { end = boundary;break; }
      }
    }
    parts.push(characters.slice(index, end).join(""));
    index = end;
  }
  return parts;
}
