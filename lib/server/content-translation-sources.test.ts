// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./announcements", () => ({ getAnnouncementById: vi.fn() }));
vi.mock("./announcement-ai", () => ({ attachAnnouncementAiSummaries: vi.fn(async value => value) }));
vi.mock("./crawl-data", () => ({ readDailyCrawlDataJson: vi.fn() }));
vi.mock("./home-data", () => ({ getHomeAcademicSchedules: vi.fn(), getHomeCafeteriaSnapshot: vi.fn(), getHomePhoneNumbers: vi.fn(), getHomeShuttleBuses: vi.fn(), getHomeShuttleSpecialPeriods: vi.fn() }));
vi.mock("../serviceNotices", () => ({ getServiceNoticeBySlug: vi.fn() }));
vi.mock("./public-managed-content", async importOriginal => ({ ...await importOriginal<typeof import("./public-managed-content")>(), getPublicManagedContentRecord: vi.fn() }));
import { resolvePublicTranslationSource } from "./content-translation-sources";
import { getAnnouncementById } from "./announcements";
import { getHomeAcademicSchedules, getHomeCafeteriaSnapshot, getHomePhoneNumbers, getHomeShuttleBuses, getHomeShuttleSpecialPeriods } from "./home-data";
import type { Announcement } from "@/types";
import { getServiceNoticeBySlug } from "../serviceNotices";
import { splitPublicContentText } from "../content-translation";
import { readDailyCrawlDataJson } from "./crawl-data";
import { getPublicManagedContentRecord } from "./public-managed-content";
import type { PublicManagedPublication } from "@/types/managed-content";
import * as publicData from "./public-data";

beforeEach(() => vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No external source/provider calls in source tests"); })));
afterEach(() => {vi.unstubAllGlobals();vi.unstubAllEnvs();vi.clearAllMocks();vi.restoreAllMocks();});
describe("allowlisted published translation sources", () => {
  it("projects public announcement/AI fields but excludes authors, URLs, IDs and dates", async () => {
    vi.mocked(getAnnouncementById).mockResolvedValue({ id: "a", title: "제목", content: "본문", author: "개인 이름", date: "2026-10-26", url: "https://school.test", aiSummary: { summary: "요약", deadline: "기한", target: "대상", requiredAction: "제출", keywords: ["키워드"] } } as Announcement);
    expect(await resolvePublicTranslationSource({ kind: "announcement", category: "academic", id: "a" })).toEqual({ title: "제목", content: "본문", "contentParts.0": "본문", "aiSummary.summary": "요약", "aiSummary.deadline": "기한", "aiSummary.target": "대상", "aiSummary.requiredAction": "제출", "aiSummary.keywords.0": "키워드" });
  });
  it("uses original menu identity and only the displayed food names", async () => {
    vi.mocked(getHomeCafeteriaSnapshot).mockResolvedValue({ checkedAt: null, stale: false, menus: [{ id: "cafeteria-2026-10-26-0", date: "2026-10-26", dayOfWeek: "월", location: "SU", breakfast: [{ name: "김밥", allergens: ["계란"], calories: 500 }], lunch: { a: [{ name: "카레", allergens: ["우유"] }] }, dinner: [] }] });
    expect(await resolvePublicTranslationSource({ kind: "cafeteria", id: "2026-10-26" })).toEqual({ location: "SU", "breakfast.0": "김밥", "lunch.a.0": "카레", "allergens.breakfast.0.0": "계란", "allergens.lunch.a.0.0": "우유" });
  });
  it("preserves schedules and phone data by excluding time and contact fields", async () => {
    vi.mocked(getHomeAcademicSchedules).mockResolvedValue([{ id: "exam", title: "중간고사", description: "안내", startDate: "2026-10-26", endDate: "2026-10-27", category: "exam" }]);
    vi.mocked(getHomePhoneNumbers).mockResolvedValue([{ department: "학사지원팀", description: "학사 안내", phone: "02-0000-0000" }]);
    expect(await resolvePublicTranslationSource({ kind: "schedule", id: "exam" })).toEqual({ title: "중간고사", description: "안내" });
    expect(await resolvePublicTranslationSource({ kind: "phone", id: "학사지원팀" })).toEqual({ department: "학사지원팀", description: "학사 안내" });
  });
  it("rejects unknown/publicly absent identities", async () => {
    vi.mocked(getAnnouncementById).mockResolvedValue(null);
    await expect(resolvePublicTranslationSource({ kind: "announcement", category: "academic", id: "absent" })).rejects.toMatchObject({ status: 404 });
    await expect(resolvePublicTranslationSource({ kind: "library", id: "../../private" })).rejects.toMatchObject({ status: 404 });
    await expect(resolvePublicTranslationSource({ kind: "graduation", id: "private-user-state" })).rejects.toMatchObject({ status: 404 });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("only exposes bundled graduation label leaves and map copy", async () => {
    const labels = await resolvePublicTranslationSource({ kind: "graduation", id: "2026" });
    expect(labels["colleges.0.name"]).toBe("신학대학");expect(labels["colleges.0.id"]).toBeUndefined();
    expect(Object.keys(labels).some(key => /Credits|sourceSha|sourceFile|sourcePages/.test(key))).toBe(false);
    const building = await resolvePublicTranslationSource({ kind: "map", id: "baekjuyeon" });
    expect(building.name).toBe("백주년기념관");expect(building.lat).toBeUndefined();expect(building.image).toBeUndefined();
  });
  it("splits long notice content without losing Unicode characters or whitespace", async () => {
    const content = "가🙂\n ".repeat(1600);
    const parts = splitPublicContentText(content);
    expect(parts.join("")).toBe(content);expect(parts.every(part => [...part].length <= 3000)).toBe(true);
    expect(splitPublicContentText("단어 하나 문장 둘 문장 셋", 8)).toEqual(["단어 하나 ", "문장 둘 문장 ", "셋"]);
    vi.mocked(getServiceNoticeBySlug).mockResolvedValue({ id: "n", slug: "n", title: "공지", date: "2026-10-26", author: "Team", content });
    const fields = await resolvePublicTranslationSource({ kind: "service-notice", id: "n" });
    expect(Object.keys(fields).some(field => field.startsWith("markdownText."))).toBe(true);
    expect(fields.content).toBeUndefined();expect(fields["contentParts.0"]).toBeUndefined();
    expect(fields.author).toBeUndefined();
  });
  it("resolves competition identities from the published source category", async () => {
    vi.mocked(readDailyCrawlDataJson).mockResolvedValue([{ id: "event-published", title: "공모전", content: "참가 안내", category: "academic", author: "홍길동", date: "2026-10-26", url: "https://school.test" }]);
    const fields = await resolvePublicTranslationSource({ kind: "competition", category: "event", id: "event-published" });
    expect(fields.title).toBe("공모전");expect(fields.author).toBeUndefined();expect(fields.url).toBeUndefined();
    expect(readDailyCrawlDataJson).toHaveBeenCalledWith("announcements-events.json");
  });
  it("resolves published tips without forwarding link or author metadata", async () => {
    const fields = await resolvePublicTranslationSource({ kind: "tip", id: "campus-life-absence-2025" });
    expect(fields.title).toContain("유고결석");expect(fields["tags.0"]).toBe("유고결석");expect(fields.url).toBeUndefined();expect(fields.category).toBeUndefined();
  });
  it("resolves fixed library and shuttle labels without seat IDs or departure times", async () => {
    const fields = await resolvePublicTranslationSource({ kind: "library", id: "semester" });
    expect(fields.label).toBe("학기 중");expect(fields["floors.0.name"]).toBe("지하1층");
    expect(fields["floors.0.rooms.0.name"]).toBe("나눔실");expect(fields.ROOM_SEAT_MAP_URLS).toBeUndefined();
    vi.mocked(getHomeShuttleBuses).mockResolvedValue([{ id: "shuttle-0", routeName: "화랑대역(5번 출구) → 학교", startLocation: "화랑대역(5번 출구)", endLocation: "학교", stops: ["학교"], schedules: { mondayToThursday: ["08:10"], friday: [], mondayToThursdayVacation: [], fridayVacation: [] }, lastUpdated: "2026-10-26" }]);
    expect(await resolvePublicTranslationSource({ kind: "shuttle", id: "shuttle-0" })).toEqual({ routeName: "화랑대역(5번 출구) → 학교", startLocation: "화랑대역(5번 출구)", endLocation: "학교", "stops.0": "학교" });
  });
  it("projects special shuttle period labels without changing their dates, schedules or source URL", async () => {
    vi.mocked(getHomeShuttleSpecialPeriods).mockResolvedValue({ specialPeriods: [{ id: "festival", name: "축제 셔틀", description: "22:00 이후 5대 운행", startDate: "2026-10-06", endDate: "2026-10-06", applicableDates: ["2026-10-06"], routes: ["shuttle-0"], addedTimes: ["22:00"], sourceUrl: "https://school.test/original" }], semesterPeriods: [], vacationPeriods: [] });
    expect(await resolvePublicTranslationSource({ kind: "shuttle", id: "__periods__" })).toEqual({ "periods.festival.name": "축제 셔틀", "periods.festival.description": "22:00 이후 5대 운행" });
  });
  it("validates Manna public JSON and only exposes the chosen day's menus", async () => {
    vi.stubEnv("NEXT_PUBLIC_CAFETERIA_JSON_URL", "https://fixture.example/cafeteria/student-restaurant-1.json");
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ updatedAt: "2026-10-26T00:00:00Z", weekStart: "2026-10-26", days: [{ date: "2026-10-26", breakfast: null, lunch: ["김치볶음밥"], dinner: ["우동"], ingredients: { breakfast: null, lunch: ["쌀, 김치"], dinner: null } }] }));
    expect(await resolvePublicTranslationSource({ kind: "student-restaurant", id: "2026-10-26" })).toEqual({ "lunch.0": "김치볶음밥", "dinner.0": "우동", "ingredients.lunch.0": "쌀, 김치" });
    expect(fetch).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ credentials: "omit", redirect: "error" }));
  });
  it.each(["", "firebase"])("uses the same Manna reader as the displayed menu and never a separate URL (%s)", async (backend) => {
    vi.stubEnv("PUBLIC_DATA_BACKEND", backend);
    vi.stubEnv("NEXT_PUBLIC_CAFETERIA_JSON_URL", "");
    const read = vi.spyOn(publicData, "readPublicDataJson").mockResolvedValueOnce({
      updatedAt: "2026-10-26T00:00:00Z", weekStart: "2026-10-26",
      days: [{ date: "2026-10-26", breakfast: null, lunch: ["공용 원문"], dinner: [], ingredients: { breakfast: null, lunch: ["쌀"], dinner: [] } }],
    });
    expect(await resolvePublicTranslationSource({ kind: "student-restaurant", id: "2026-10-26" })).toEqual({ "lunch.0": "공용 원문", "ingredients.lunch.0": "쌀" });
    expect(read).toHaveBeenCalledWith("student-restaurant-1.json");
    expect(fetch).not.toHaveBeenCalled();
  });
  it("normalizes configured live course source and excludes professor/contact/credit/time fields", async () => {
    vi.stubEnv("LECTURE_TIMETABLE_URL", "https://fixture.example/lectures");
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ year: "2026", semester: "2", data: [{ 강좌번호: "28", 과목명: "채플", "학부(과)": "간호학과", 교수명: "개인 이름", 학점: "0", 수업시간: "화8", 장소: "다니엘관207호" }] }));
    expect(await resolvePublicTranslationSource({ kind: "course", id: "28" })).toEqual({ courseName: "채플", departmentName: "간호학과", place: "다니엘관207호" });
    expect(await resolvePublicTranslationSource({ kind: "course", id: "__departments__" })).toEqual({ "departments.0": "간호학과" });
    await expect(resolvePublicTranslationSource({ kind: "course", id: "29" })).rejects.toMatchObject({ status: 404 });expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("exposes only active published banner copy and never draft, image URLs or destination links", async () => {
    const item = { id: "banner-public", kind: "banner", archived: false, published: { kind: "banner", title: "공개 행사", description: "함께 참여하세요", imageAlt: "행사 포스터", imageDesktop: "/private-image", link: "https://private-link.test", startsAt: null, endsAt: null }, draft: { title: "비공개 초안" } } as unknown as PublicManagedPublication;
    vi.mocked(getPublicManagedContentRecord).mockResolvedValue(item);
    expect(await resolvePublicTranslationSource({ kind: "banner", id: item.id })).toEqual({ title: "공개 행사", description: "함께 참여하세요", imageAlt: "행사 포스터" });
    for (const hidden of [{ ...item, archived: true }, { ...item, published: null }, { ...item, published: { ...item.published, startsAt: "2099-01-01T00:00:00Z" } }]) {
      vi.mocked(getPublicManagedContentRecord).mockResolvedValue(hidden as PublicManagedPublication);
      await expect(resolvePublicTranslationSource({ kind: "banner", id: item.id })).rejects.toMatchObject({ status: 404 });
    }
  });
  it("keeps service Markdown URLs, raw HTML and code outside translation fields", async () => {
    vi.mocked(getServiceNoticeBySlug).mockResolvedValue({ id: "n", slug: "n", title: "안내", date: "2026-10-26", author: "작성자", content: "# 제목\n\n**굵게** [원문](https://example.test/한국어?q=1) `비공개_코드`\n\n```js\nconst 값=123\n```\n\n<div>\n원시HTML\n</div>" });
    const fields = await resolvePublicTranslationSource({ kind: "service-notice", id: "n" });
    const values = Object.values(fields).join(" ");expect(values).toContain("제목");expect(values).toContain("굵게");expect(values).toContain("원문");
    expect(values).not.toMatch(/example\.test|비공개_코드|const 값|원시HTML|작성자/);
  });
  it("limits graduation support projections to fixed public labels and course names", async () => {
    const support = await resolvePublicTranslationSource({ kind: "graduation", id: "support-2026" });
    expect(support["rules.computer-major-detail.label"]).toContain("21학점");
    expect(support["sources.syu-graduation-guide.title"]).toBe("삼육대학교 졸업 안내");
    expect(Object.keys(support).some(key => key.startsWith("selectionGroups."))).toBe(true);
    expect(Object.keys(support).some(key => /url|sourceYear|departmentId|verifiedAt/.test(key))).toBe(false);
    const curriculum = await resolvePublicTranslationSource({ kind: "graduation", id: "curriculum-2026" });
    expect(Object.keys(curriculum).length).toBeGreaterThan(0);expect(Object.keys(curriculum).every(key => /^courses\..+\.name$/.test(key))).toBe(true);
  });
});
