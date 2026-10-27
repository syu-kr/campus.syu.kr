import { readPublicDataBundle, readPublicDataJson } from "./public-data";
import type { PublicDataFile } from "../public-data-snapshot";
import { ApiError } from "./http";
import { getAnnouncementById } from "./announcements";
import { attachAnnouncementAiSummaries } from "./announcement-ai";
import { readDailyCrawlDataJson } from "./crawl-data";
import { getHomeAcademicSchedules, getHomeCafeteriaSnapshot, getHomePhoneNumbers, getHomeShuttleBuses, getHomeShuttleSpecialPeriods } from "./home-data";
import { getServiceNoticeBySlug } from "../serviceNotices";
import { LIBRARY_OPERATING_HOURS } from "../library";
import { normalizeLectureTimetablePayload } from "../lecture-timetable";
import { parseStudentRestaurantMenu } from "../student-restaurant";
import { readResponseBytes } from "./read-response-bytes";
import { toCompetitionCandidate } from "./competitions";
import type { ContentTranslationSource } from "../content-translation";
import { splitPublicContentText } from "../content-translation";
import { markdownTranslationFields } from "../markdown-translation";
import { getPublicManagedContentRecord, isVisiblePublication } from "./public-managed-content";
import type { Announcement, CampusTip } from "@/types";
import type { DailyCrawlDataFile } from "../crawl-data-contract";

type RecordValue = Record<string, unknown>;
type PublicFields = Record<string, string>;
const sourceFiles = {
  event: "announcements-events.json",
  department: "announcements-departments.json",
} as const;

function missing(): never {
  throw new ApiError("This public content is unavailable.", 404, undefined, "SOURCE_NOT_FOUND");
}

function isRecord(value: unknown): value is RecordValue {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function put(fields: PublicFields, key: string, value: unknown) {
  if (typeof value === "string" && value.trim()) fields[key] = value;
}

function pick(value: unknown, names: readonly string[], prefix = "", fields: PublicFields = {}) {
  if (!isRecord(value)) return fields;
  for (const name of names) put(fields, prefix + name, value[name]);
  return fields;
}

function strings(fields: PublicFields, prefix: string, values: unknown) {
  if (Array.isArray(values)) values.forEach((value, index) => put(fields, `${prefix}.${index}`, value));
}

async function readBundled(fileName: PublicDataFile): Promise<unknown> {
  // fileName comes only from the fixed branches below, never from a request.
  return readPublicDataJson(fileName);
}

function rows(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function byId(value: unknown, id: string) {
  return rows(value).find(item => item.id === id) ?? missing();
}

function announcementFields(item: Announcement) {
  const fields = pick(item, ["title", "content"]);
  if (item.content) strings(fields, "contentParts", splitPublicContentText(item.content));
  pick(item.aiSummary, ["summary", "deadline", "requiredAction", "target"], "aiSummary.", fields);
  strings(fields, "aiSummary.keywords", item.aiSummary?.keywords);
  return fields;
}

function addBuilding(fields: PublicFields, item: RecordValue) {
  pick(item, ["name", "category"], "", fields);
  rows(item.floors).forEach((floor, i) => {
    put(fields, `floors.${i}.description`, floor.description);
    rows(floor.facilities).forEach((facility, j) => {
      pick(facility, ["name", "category", "description"], `floors.${i}.facilities.${j}.`, fields);
    });
  });
  return fields;
}

function publicGraduationLabels(value: unknown, prefix = "", fields: PublicFields = {}): PublicFields {
  const labels = new Set(["name", "label", "description", "title", "message", "note", "notes", "policy", "sourceTitle", "condition", "conditions", "graduationConditions", "requiredCourses", "warnings"]);
  if (Array.isArray(value)) {
    value.forEach((child, i) => publicGraduationLabels(child, `${prefix}${i}.`, fields));
  } else if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (labels.has(key) && typeof child === "string") put(fields, prefix + key, child);
      else if (Array.isArray(child) && labels.has(key) && child.every(item => typeof item === "string")) strings(fields, prefix + key, child);
      else if (child && typeof child === "object") publicGraduationLabels(child, `${prefix}${key}.`, fields);
    }
  }
  return fields;
}

let courseSource: { expires: number; promise: Promise<ReturnType<typeof normalizeLectureTimetablePayload>> } | undefined;
async function courses() {
  if (!courseSource || courseSource.expires < Date.now()) {
    const url = process.env.LECTURE_TIMETABLE_URL;
    if (!url) missing();
    const promise = fetch(url, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12_000) })
      .then(async response => {
        if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) missing();
        return normalizeLectureTimetablePayload(JSON.parse(new TextDecoder().decode(await readResponseBytes(response, 8 * 1024 * 1024, "Timetable source"))));
      }).catch(error => { courseSource = undefined; throw error; });
    courseSource = { expires: Date.now() + 6 * 60 * 60 * 1000, promise };
  }
  return courseSource.promise;
}

/** Resolve only published fields. Request text, private records and arbitrary URLs never enter this path. */
export async function resolvePublicTranslationSource(source: ContentTranslationSource): Promise<PublicFields> {
  switch (source.kind) {
    case "announcement": {
      return resolveAnnouncement(source);
    }
    case "competition": {
      return resolveAnnouncement(source);
    }
    case "cafeteria": {
      const { menus } = await getHomeCafeteriaSnapshot();
      const menu = menus.find(item => item.id === source.id || item.date === source.id) ?? missing();
      const fields = pick(menu, ["location"]);
      for (const meal of ["breakfast", "dinner"] as const) {
        strings(fields, meal, menu[meal]?.map(item => item.name));
        menu[meal]?.forEach((item, index) => strings(fields, `allergens.${meal}.${index}`, item.allergens));
      }
      for (const corner of ["a", "b"] as const) {
        strings(fields, `lunch.${corner}`, menu.lunch[corner]?.map(item => item.name));
        menu.lunch[corner]?.forEach((item, index) => strings(fields, `allergens.lunch.${corner}.${index}`, item.allergens));
      }
      return fields;
    }
    case "student-restaurant": {
      const menu = parseStudentRestaurantMenu(await readPublicDataJson("student-restaurant-1.json"));
      const day = menu.days.find(item => item.date === source.id) ?? missing();
      const fields: PublicFields = {};
      for (const meal of ["breakfast", "lunch", "dinner"] as const) {
        strings(fields, meal, day[meal]);
        strings(fields, `ingredients.${meal}`, day.ingredients?.[meal]);
      }
      return fields;
    }
    case "schedule":
      return pick((await getHomeAcademicSchedules()).find(item => item.id === source.id) ?? missing(), ["title", "description"]);
    case "tip": {
      const tip = byId(await readBundled("campus-tips.json"), source.id) as unknown as CampusTip;
      const fields = pick(tip, ["title", "description", "note", "urlLabel"]);
      strings(fields, "tags", tip.tags);
      return fields;
    }
    case "service-notice": {
      const notice = await getServiceNoticeBySlug(source.id);
      if (!notice) missing();
      const fields = pick(notice, ["title", "excerpt"]);
      Object.assign(fields, markdownTranslationFields(notice.content));
      return fields;
    }
    case "banner": {
      const item = await getPublicManagedContentRecord(source.id);
      if (!item || item.published?.kind !== "banner" || !isVisiblePublication(item)) missing();
      return pick(item.published, ["title", "description", "imageAlt"]);
    }
    case "phone": {
      const numbers = await getHomePhoneNumbers();
      const item = numbers.find(row => row.department === source.id) ?? (/^\d+$/.test(source.id) ? numbers[Number(source.id)] : undefined);
      return pick(item ?? missing(), ["department", "description"]);
    }
    case "shuttle": {
      if (source.id === "__periods__") {
        const periods = await getHomeShuttleSpecialPeriods(), fields: PublicFields = {};
        periods.specialPeriods.forEach(period => pick(period, ["name", "description"], `periods.${period.id}.`, fields));
        return fields;
      }
      const item = (await getHomeShuttleBuses()).find(row => row.id === source.id) ?? missing();
      const fields = pick(item, ["routeName", "startLocation", "endLocation"]);
      strings(fields, "stops", item.stops);
      return fields;
    }
    case "library": {
      if (source.id !== "semester" && source.id !== "vacation") missing();
      const hours = LIBRARY_OPERATING_HOURS[source.id];
      const fields = pick(hours, ["label"]);
      hours.floors.forEach((floor, i) => {
        put(fields, `floors.${i}.name`, floor.name);
        floor.rooms.forEach((room, j) => {
          pick(room, ["name", "note"], `floors.${i}.rooms.${j}.`, fields);
          for (const [day, value] of Object.entries(room.schedule)) put(fields, `floors.${i}.rooms.${j}.schedule.${day}`, value);
        });
      });
      return fields;
    }
    case "map": {
      const data = await import("@/app/campus/map/data/buildings.json");
      return addBuilding({}, byId(data.buildings, source.id));
    }
    case "course": {
      const dataset = await courses();
      if (source.id === "__departments__") {
        const fields: PublicFields = {};
        strings(fields, "departments", [...new Set(dataset.courses.map(course => course.departmentName).filter((name): name is string => Boolean(name)))].sort((a, b) => a.localeCompare(b, "en-US")));
        return fields;
      }
      return pick(dataset.courses.find(course => course.id === source.id) ?? missing(), ["courseName", "departmentName", "collegeName", "completionType", "areaType", "place", "note"]);
    }
    case "graduation": {
      if (source.id === "support-2026") {
        const { data } = await readPublicDataBundle(["graduation-department-rules.json", "graduation-sources.json", "curriculum-course-selection-rules-2026.json"]);
        const rules = data["graduation-department-rules.json"], sources = data["graduation-sources.json"], selections = data["curriculum-course-selection-rules-2026.json"];
        const fields: PublicFields = {};
        if (isRecord(rules)) rows(rules.rules).forEach(rule => { if (typeof rule.id === "string") pick(rule, ["label", "description"], `rules.${rule.id}.`, fields); });
        if (isRecord(sources)) rows(sources.sources).forEach(item => { if (typeof item.id === "string") pick(item, ["title", "scope"], `sources.${item.id}.`, fields); });
        if (isRecord(selections)) rows(selections.exclusiveGroups).forEach(group => { if (typeof group.id === "string") pick(group, ["label"], `selectionGroups.${group.id}.`, fields); });
        return fields;
      }
      if (source.id === "curriculum-2026") {
        const data = await readBundled("curriculum-courses-2026-verified.json"), fields: PublicFields = {};
        if (isRecord(data)) rows(data.courses).forEach(course => { if (typeof course.id === "string") pick(course, ["name"], `courses.${course.id}.`, fields); });
        return fields;
      }
      if (source.id !== "2025" && source.id !== "2026") missing();
      return publicGraduationLabels(await readBundled(`graduation-requirements-${source.id}.json`));
    }
    default: missing();
  }
}

async function resolveAnnouncement(source: ContentTranslationSource) {
  const category = source.category;
  let item: Announcement | null = null;
  if (category === "event" || category === "department") {
    const raw = rows(await readDailyCrawlDataJson<unknown>(sourceFiles[category] as DailyCrawlDataFile)).find(row => row.id === source.id);
    const candidate = raw && toCompetitionCandidate(raw, category, 0);
    if (candidate) [item] = await attachAnnouncementAiSummaries([candidate]);
  } else if (category === "academic" || category === "campus" || category === "scholarship" || category === "sw") {
    item = await getAnnouncementById(category, source.id);
  }
  return announcementFields(item ?? missing());
}
