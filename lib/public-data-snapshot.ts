import { CRAWL_DATA_MAX_BYTES, DAILY_CRAWL_DATA_FILES, isDailyCrawlDataFile, parseCrawlDataManifest, parseCrawlSourceHealthMap, validateCrawlDataVersion, validateDailyCrawlData, type CrawlSourceHealth } from "./crawl-data-contract";
import { parseStudentRestaurantMenu } from "./student-restaurant";

export const REFERENCE_DATA_FILES = [
  "phone-numbers.json", "schedules-major.json", "campus-tips.json", "shuttle-bus-schedule.json", "shuttle-special-periods.json",
  "curriculum-course-selection-rules-2026.json", "curriculum-course-selection-rules.json", "curriculum-courses-2025-verified.json", "curriculum-courses-2026-verified.json",
  "graduation-department-rules.json", "graduation-requirements-2025.json", "graduation-requirements-2026.json", "graduation-sources.json",
] as const;
export const PUBLIC_DATA_FILES = [...DAILY_CRAWL_DATA_FILES, ...REFERENCE_DATA_FILES, "student-restaurant-1.json"] as const;
export type PublicDataFile = typeof PUBLIC_DATA_FILES[number];
interface PublicDataEntry { path: string; sha256: string; size: number }
export interface PublicDataManifest {
  schemaVersion: 1;
  version: string;
  publishedAt: string;
  files: Partial<Record<PublicDataFile, PublicDataEntry>>;
  retainedVersions: string[];
  sourceHealth: Partial<Record<typeof DAILY_CRAWL_DATA_FILES[number], CrawlSourceHealth>>;
}
const fileSet = new Set<string>(PUBLIC_DATA_FILES);
const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const rows = (value: unknown): value is Record<string, unknown>[] => Array.isArray(value) && value.every(record);
function requireData(valid: boolean, file: string): asserts valid { if (!valid) throw new Error(`Invalid public data: ${file}`); }
export function isPublicDataFile(value: string): value is PublicDataFile { return fileSet.has(value); }
export function publicDataMaxBytes(file: PublicDataFile): number {
  return isDailyCrawlDataFile(file) ? CRAWL_DATA_MAX_BYTES[file] : file.startsWith("curriculum-courses-") || file.startsWith("graduation-requirements-") ? 4 * 1024 * 1024 : file === "student-restaurant-1.json" ? 128 * 1024 : 1024 * 1024;
}
export function publicDataPath(version: string, file: PublicDataFile | "manifest.json") { return `public-data/versions/${validateCrawlDataVersion(version)}/${file}`; }
export function asDailyCrawlManifest(manifest: PublicDataManifest) {
  return parseCrawlDataManifest({ ...manifest, files: Object.fromEntries(DAILY_CRAWL_DATA_FILES.map(file => [file, { ...manifest.files[file], path: `versions/${manifest.version}/${file}` }])) });
}

export function parsePublicDataManifest(value: unknown): PublicDataManifest {
  requireData(record(value) && value.schemaVersion === 1 && text(value.version) && text(value.publishedAt) && Number.isFinite(Date.parse(value.publishedAt)) && record(value.files), "manifest");
  const version = validateCrawlDataVersion(value.version);
  requireData(Array.isArray(value.retainedVersions) && value.retainedVersions.length > 0 && value.retainedVersions.length <= 7 && value.retainedVersions.every(text), "manifest versions");
  const retainedVersions = value.retainedVersions.map(validateCrawlDataVersion);
  requireData(new Set(retainedVersions).size === retainedVersions.length && retainedVersions.includes(version), "manifest versions");
  requireData(Object.keys(value.files).every(isPublicDataFile), "manifest allowlist");
  const files: PublicDataManifest["files"] = {};
  for (const file of PUBLIC_DATA_FILES) {
    const entry = value.files[file];
    if (entry === undefined && file === "student-restaurant-1.json") continue;
    requireData(record(entry) && entry.path === publicDataPath(version, file) && typeof entry.sha256 === "string" && /^[a-f0-9]{64}$/.test(entry.sha256) && Number.isSafeInteger(entry.size) && typeof entry.size === "number" && entry.size > 0 && entry.size <= publicDataMaxBytes(file), file);
    files[file] = { path: entry.path as string, sha256: entry.sha256, size: entry.size };
  }
  return { schemaVersion: 1, version, publishedAt: value.publishedAt, files, retainedVersions, sourceHealth: value.sourceHealth === undefined ? {} : parseCrawlSourceHealthMap(value.sourceHealth) };
}

/** Validate each allowlisted file before publishing and after downloading it. */
export function validatePublicData(file: PublicDataFile, value: unknown): void {
  if (isDailyCrawlDataFile(file)) { validateDailyCrawlData(file, value); return; }
  if (file === "student-restaurant-1.json") { parseStudentRestaurantMenu(value); return; }
  if (file === "phone-numbers.json") { requireData(rows(value) && value.every(row => text(row.department) && text(row.phone) && (row.phoneNumbers === undefined || Array.isArray(row.phoneNumbers) && row.phoneNumbers.every(text))), file); return; }
  if (file === "schedules-major.json") { requireData(rows(value) && value.every(row => text(row.id) && text(row.title) && /^\d{4}\.\d{2}\.\d{2}$/.test(String(row.startDate)) && /^\d{4}\.\d{2}\.\d{2}$/.test(String(row.endDate))), file); return; }
  if (file === "campus-tips.json") {
    requireData(rows(value) && value.every(row => text(row.id) && text(row.title) && text(row.category) && text(row.url) && /^https:\/\//.test(row.url) && Array.isArray(row.tags) && row.tags.every(text)), file); return;
  }
  if (file === "shuttle-bus-schedule.json") {
    requireData(rows(value) && value.length > 0 && value.every(row => text(row.id) && text(row.routeName) && record(row.schedules) && Object.values(row.schedules).every(times => Array.isArray(times) && times.every(time => typeof time === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(time)))), file); return;
  }
  if (file === "shuttle-special-periods.json") {
    requireData(record(value) && ["specialPeriods", "semesterPeriods", "vacationPeriods"].every(key => rows(value[key])), file); return;
  }
  requireData(record(value) && record(value.metadata), file);
  if (file.startsWith("curriculum-course-selection-rules")) {
    requireData(rows(value.exclusiveGroups) && value.exclusiveGroups.every(group => text(group.id) && Array.isArray(group.courseIds) && group.courseIds.every(text)), file); return;
  }
  if (file.startsWith("curriculum-courses-")) {
    requireData(rows(value.courses) && value.courses.length > 0 && value.courses.every(course => text(course.id) && text(course.departmentId) && text(course.name) && typeof course.credits === "number" && Number.isFinite(course.credits) && course.credits >= 0), file); return;
  }
  if (file === "graduation-department-rules.json") { requireData(rows(value.rules) && value.rules.every(rule => text(rule.id) && text(rule.departmentId) && Array.isArray(rule.sourceIds) && rule.sourceIds.every(text)), file); return; }
  if (file === "graduation-sources.json") { requireData(rows(value.sources) && value.sources.every(source => text(source.id) && text(source.title)), file); return; }
  requireData(rows(value.colleges) && rows(value.departments) && rows(value.requirementProfiles) && value.requirementProfiles.length > 0 && record(value.aliases), file);
  requireData(value.colleges.every(college => text(college.id) && text(college.name) && typeof college.order === "number") && value.departments.every(department => text(department.id) && text(department.collegeId) && text(department.name)) && value.requirementProfiles.every(profile => text(profile.id) && text(profile.requirementGroup) && text(profile.admissionType) && text(profile.majorTrack) && typeof profile.totalCredits === "number" && Number.isFinite(profile.totalCredits) && profile.totalCredits >= 0 && record(profile.categories)), file);
}
