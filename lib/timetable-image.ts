export function getTimetableImageFilename(
  year?: string | null,
  semester?: string | null,
  now = new Date(),
): string {
  const semesterLabel = [year, semester]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value))
    .join("-")
    .normalize("NFKC")
    .replace(/[^\p{L}\p{N}-]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  const dateLabel = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");

  return ["syu-campus-timetable", semesterLabel, dateLabel]
    .filter(Boolean)
    .join("-")
    .concat(".png");
}
