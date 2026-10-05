import type { PhoneNumber } from "@/types/phone";

const PHONE_NUMBER_PATTERN =
  /(?:\+82[\s-]?)?0\d{1,2}[\s)./-]?\d{3,4}[\s.-]?\d{4}/g;

function extractPhoneNumbers(value: string | null | undefined): string[] {
  if (!value) return [];

  const matches = value.match(PHONE_NUMBER_PATTERN) ?? [];
  return uniquePhoneNumbers(matches.map(normalizeDisplayPhoneNumber));
}

export function getPhoneNumberOptions(
  phone: Pick<PhoneNumber, "phone" | "phoneNumbers">,
): string[] {
  const structuredNumbers = phone.phoneNumbers
    ?.map(normalizeDisplayPhoneNumber)
    .filter(Boolean);

  if (structuredNumbers?.length) {
    return uniquePhoneNumbers(structuredNumbers);
  }

  const parsedNumbers = extractPhoneNumbers(phone.phone);
  return parsedNumbers.length ? parsedNumbers : [phone.phone].filter(Boolean);
}

export function getPhoneDisplayText(
  phone: Pick<PhoneNumber, "phone" | "phoneNumbers">,
): string {
  const extraText = phone.phone
    .replace(PHONE_NUMBER_PATTERN, "")
    .replace(/[\s,;/|-]+/g, "");

  // Keep source labels, extensions and shortened ranges rather than guessing them.
  return extraText ? phone.phone : getPhoneNumberOptions(phone).join(", ");
}

export function matchesPhoneQuery(phone: PhoneNumber, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  if (
    [phone.department, phone.description, phone.phone].some((value) =>
      value?.toLowerCase().includes(normalizedQuery),
    )
  ) {
    return true;
  }

  const digits = normalizedQuery.replace(/[\s().+-]/g, "");
  return /^\d+$/.test(digits) && getPhoneNumberOptions(phone).some((number) =>
    number.replace(/\D/g, "").includes(digits),
  );
}

export function getTelHref(phoneNumber: string): string {
  const trimmed = phoneNumber.trim();
  const digits = trimmed.startsWith("+")
    ? `+${trimmed.replace(/[^\d]/g, "")}`
    : trimmed.replace(/[^\d]/g, "");

  return `tel:${digits || trimmed}`;
}

function normalizeDisplayPhoneNumber(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[().]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function uniquePhoneNumbers(numbers: string[]): string[] {
  return Array.from(new Set(numbers.filter(Boolean)));
}
