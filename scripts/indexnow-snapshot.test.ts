// @vitest-environment node
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildIndexNowSnapshot, changedIndexNowUrls, type SnapshotFile } from "./indexnow-snapshot";

const origin = "https://campus.syu.kr";
const notice = { id: "academic-abc", category: "academic", title: "등록 안내", date: "2026.10.15", author: "학교", content: "등록 내용", url: "https://www.syu.ac.kr/notice", views: 1, isPinned: false, isImportant: false };
function files(): Record<string, SnapshotFile> {
  return Object.fromEntries([
    ["announcements-academic.json", [notice]], ["announcements-campus-life.json", []],
    ["announcements-scholarship.json", []], ["announcements-sw.json", []],
    ["announcements-events.json", []], ["announcements-departments.json", []],
    ["announcement-ai-metadata.json", { items: {} }],
    ["cafeteria-menu.json", { menus: [{ date: "2026-10-15", meals: { lunch: ["밥"] } }], lastUpdated: "2026-10-15T01:00:00Z" }],
    ["public-holidays.json", { holidays: [], years: [2026], lastSuccessAt: "2026-10-15T01:00:00Z" }],
  ].map(([name, data]) => [`public/data/${name}`, { hash: "fixture", data }]));
}

describe("IndexNow content snapshots", () => {
  it("adds only valid public bilingual routes and detects a removed notice", () => {
    const before = files();
    before["public/service-notices/001-test.md"] = { hash: "notice" };
    const old = buildIndexNowSnapshot(before);
    expect(old[`${origin}/announcements/academic/academic-abc`]).toBeDefined();
    expect(old[`${origin}/en/announcements/academic/academic-abc`]).toBeDefined();
    expect(old[`${origin}/service/notices/001-test`]).toBeDefined();
    expect(old[`${origin}/en`]).toBeDefined();
    expect(Object.keys(old).some((url) => /\/api\/|\/admin|roommate|\/data\//.test(url))).toBe(false);
    const after = files();
    after["public/data/announcements-academic.json"].data = [];
    const changes = changedIndexNowUrls(old, buildIndexNowSnapshot(after));
    expect(changes).toContain(`${origin}/announcements/academic/academic-abc`);
    expect(changes).toContain(`${origin}/en/service/notices/001-test`);
    expect(changes).not.toContain(`${origin}/campus/cafeteria`);
  });

  it("does not notify on timestamps, views, test code, workflows, or key changes alone", () => {
    const before = files();
    const after = structuredClone(before);
    after["public/data/announcements-academic.json"].data = [{ ...notice, views: 999 }];
    after["public/data/cafeteria-menu.json"].data = { ...(after["public/data/cafeteria-menu.json"].data as object), lastUpdated: "later" };
    after["public/data/public-holidays.json"].data = { holidays: [], years: [2026], lastSuccessAt: "later" };
    after["app/components/Card.test.tsx"] = { hash: "changed" };
    after[".github/workflows/indexnow.yml"] = { hash: "changed" };
    after["public/indexnow-key.txt"] = { hash: "changed" };
    after["public/indexnow-deployment.json"] = { hash: "changed" };
    expect(changedIndexNowUrls(buildIndexNowSnapshot(before), buildIndexNowSnapshot(after))).toEqual([]);
  });

  it("notifies cafeteria and home when menu content changes and keeps unrelated pages stable", () => {
    const before = files(), after = files();
    after["public/data/cafeteria-menu.json"].data = { menus: [{ date: "2026-10-15", meals: { lunch: ["면"] } }] };
    expect(changedIndexNowUrls(buildIndexNowSnapshot(before), buildIndexNowSnapshot(after))).toEqual([
      `${origin}/`, `${origin}/campus/cafeteria`, `${origin}/en`, `${origin}/en/campus/cafeteria`,
    ]);
  });

  it.each([
    ["cafeteria-menu.json", ["/", "/campus/cafeteria"]],
    ["public-holidays.json", ["/", "/academic/schedule", "/campus/bus-info"]],
  ] as const)("tracks source freshness changes only where %s changes the rendered answer", (file, routes) => {
    const before = files(), after = files();
    before[`public/data/${file}`].stale = false;
    after[`public/data/${file}`].stale = true;
    const expected = routes.flatMap((route) => [`${origin}${route}`, `${origin}${route === "/" ? "/en" : `/en${route}`}`]).sort();
    expect(changedIndexNowUrls(buildIndexNowSnapshot(before), buildIndexNowSnapshot(after))).toEqual(expected);
    expect(changedIndexNowUrls(buildIndexNowSnapshot(after), buildIndexNowSnapshot(before))).toEqual(expected);
  });

  it("tracks matching AI content but ignores regenerated metadata and rejects stale AI source hashes", () => {
    const before = files(), after = files();
    const sourceHash = createHash("sha256").update([notice.category, notice.id, notice.title, notice.date, notice.author, notice.content, notice.url].join("\n")).digest("hex").slice(0, 16);
    const summary = { summary: "요약", sourceHash, generatedAt: "old", provider: "openai", promptVersion: "old", schemaVersion: 1, generationFingerprint: "old" };
    before["public/data/announcement-ai-metadata.json"].data = { items: { "academic:academic-abc": summary } };
    after["public/data/announcement-ai-metadata.json"].data = { items: { "academic:academic-abc": { ...summary, generatedAt: "new", provider: "supilot", promptVersion: "new", schemaVersion: 2, generationFingerprint: "new" } } };
    expect(changedIndexNowUrls(buildIndexNowSnapshot(before), buildIndexNowSnapshot(after))).toEqual([]);
    after["public/data/announcement-ai-metadata.json"].data = { items: { "academic:academic-abc": { ...summary, summary: "바뀐 요약" } } };
    expect(changedIndexNowUrls(buildIndexNowSnapshot(before), buildIndexNowSnapshot(after))).toContain(`${origin}/announcements/academic/academic-abc`);
    after["public/data/announcement-ai-metadata.json"].data = { items: { "academic:academic-abc": { ...summary, sourceHash: "invalid" } } };
    expect(buildIndexNowSnapshot(after)).toEqual(buildIndexNowSnapshot(files()));
  });

  it("does not turn mismatched categories or unsafe IDs into detail URLs", () => {
    const input = files();
    input["public/data/announcements-academic.json"].data = [{ ...notice, category: "campus" }, { ...notice, id: "../admin" }];
    expect(Object.keys(buildIndexNowSnapshot(input)).some((url) => /\/announcements\/academic\//.test(url))).toBe(false);
    input["public/data/announcements-academic.json"].data = undefined;
    expect(() => buildIndexNowSnapshot(input)).toThrow("Missing IndexNow source");
  });

  it("keeps scoped page changes scoped and includes shared UI changes", () => {
    const before = files(), after = files();
    before["app/features/academic/SchedulePageClient.tsx"] = { hash: "old" };
    after["app/features/academic/SchedulePageClient.tsx"] = { hash: "new" };
    const changed = changedIndexNowUrls(buildIndexNowSnapshot(before), buildIndexNowSnapshot(after));
    expect(changed).toEqual([`${origin}/academic/schedule`, `${origin}/en/academic/schedule`]);
    after["app/components/AnswerSummarySection.tsx"] = { hash: "new" };
    expect(changedIndexNowUrls(buildIndexNowSnapshot(before), buildIndexNowSnapshot(after))).toContain(`${origin}/campus/cafeteria`);
  });

  it("tracks proxy changes that determine language and canonical URLs for every public page", () => {
    const before = files(), after = files();
    before["proxy.ts"] = { hash: "old" }; after["proxy.ts"] = { hash: "new" };
    const baseline = buildIndexNowSnapshot(before);
    expect(changedIndexNowUrls(baseline, buildIndexNowSnapshot(after))).toEqual(Object.keys(baseline).sort());
  });

  it.each([
    ["app/features/academic/GraduationPageClient.tsx", ["/academic/graduation"]],
    ["app/features/academic/graduation-persistence.ts", ["/academic/graduation"]],
    ["lib/graduation.ts", ["/academic/graduation"]],
    ["app/features/academic/CompetitionsPageClient.tsx", ["/academic/competitions"]],
    ["lib/server/competitions.ts", ["/academic/competitions"]],
    ["lib/phone.ts", ["/", "/campus/phone"]],
    ["lib/library.ts", ["/campus/library"]],
    ["lib/lecture-timetable-filter.ts", ["/academic/timetable"]],
    ["app/features/legal/LegalPageLayout.tsx", ["/privacy", "/terms"]],
    ["lib/kakao-maps-loader.ts", ["/campus/bus-info", "/campus/map"]],
    ["app/campus/map/data/buildings.json", ["/campus/map"]],
    ["app/features/cafeteria/CafeteriaMenuCards.tsx", ["/", "/campus/cafeteria"]],
  ] as const)("tracks actual page dependencies in %s without changing unrelated pages", (file, routes) => {
    const before = files(), after = files();
    before[file] = { hash: "old" }; after[file] = { hash: "new" };
    const expected = routes.flatMap((route) => [`${origin}${route}`, `${origin}${route === "/" ? "/en" : `/en${route}`}`]).sort();
    expect(changedIndexNowUrls(buildIndexNowSnapshot(before), buildIndexNowSnapshot(after))).toEqual(expected);
  });

  it.each([
    "graduation-department-rules.json", "curriculum-course-selection-rules-2026.json",
    "curriculum-courses-2026-verified.json", "graduation-requirements-2026.json", "graduation-sources.json",
  ])("tracks the graduation data actually rendered from %s", (file) => {
    const before = files(), after = files();
    before[`public/data/${file}`] = { hash: "old", data: { title: "before" } };
    after[`public/data/${file}`] = { hash: "new", data: { title: "after" } };
    expect(changedIndexNowUrls(buildIndexNowSnapshot(before), buildIndexNowSnapshot(after))).toEqual([
      `${origin}/academic/graduation`, `${origin}/en/academic/graduation`,
    ]);
  });

  it.each([
    "graduation-requirements-2025.json", "curriculum-course-selection-rules.json",
    "curriculum-course-verifications.json", "curriculum-courses-2025-audit.json",
    "curriculum-courses-2025-ocr.json", "curriculum-courses-2025-verified.json",
  ])("does not notify on unused reference data %s", (file) => {
    const before = files(), after = files();
    before[`public/data/${file}`] = { hash: "old", data: { title: "before" } };
    after[`public/data/${file}`] = { hash: "new", data: { title: "after" } };
    expect(changedIndexNowUrls(buildIndexNowSnapshot(before), buildIndexNowSnapshot(after))).toEqual([]);
  });

  it("tracks the library semester dates without notifying it for shuttle-only service edits", () => {
    const before = files(), after = files();
    const periods = { semesterPeriods: [{ startDate: "2026-09-01", endDate: "2026-12-20" }], specialPeriods: [] };
    before["public/data/shuttle-special-periods.json"] = { hash: "old", data: periods };
    after["public/data/shuttle-special-periods.json"] = { hash: "new", data: { ...periods, specialPeriods: [{ addedTimes: ["18:40"] }] } };
    let changed = changedIndexNowUrls(buildIndexNowSnapshot(before), buildIndexNowSnapshot(after));
    expect(changed).not.toContain(`${origin}/campus/library`);
    after["public/data/shuttle-special-periods.json"].data = { ...periods, semesterPeriods: [{ startDate: "2026-09-01", endDate: "2026-12-21" }] };
    changed = changedIndexNowUrls(buildIndexNowSnapshot(before), buildIndexNowSnapshot(after));
    expect(changed).toContain(`${origin}/campus/library`);
    expect(changed).toContain(`${origin}/en/campus/library`);
  });

  it.each([
    ["announcements-events.json", "event"], ["announcements-departments.json", "department"],
    ["announcements-academic.json", "academic"], ["announcements-campus-life.json", "campus"],
    ["announcements-scholarship.json", "scholarship"],
  ])("tracks competition content from %s", (file, category) => {
    const before = files(), after = files();
    before[`public/data/${file}`].data = [{ ...notice, category, title: "공모전 모집" }];
    after[`public/data/${file}`].data = [{ ...notice, category, title: "공모전 모집 수정" }];
    const changed = changedIndexNowUrls(buildIndexNowSnapshot(before), buildIndexNowSnapshot(after));
    expect(changed).toContain(`${origin}/academic/competitions`);
    expect(changed).toContain(`${origin}/en/academic/competitions`);
    expect(changed).not.toContain(`${origin}/campus/cafeteria`);
  });

  it("ignores non-competition changes but tracks matching AI text that makes a notice a competition", () => {
    const before = files(), after = files();
    after["public/data/announcements-academic.json"].data = [{ ...notice, title: "등록 안내 수정" }];
    expect(changedIndexNowUrls(buildIndexNowSnapshot(before), buildIndexNowSnapshot(after))).not.toContain(`${origin}/academic/competitions`);
    after["public/data/announcements-academic.json"].data = [notice];
    const sourceHash = createHash("sha256").update([notice.category, notice.id, notice.title, notice.date, notice.author, notice.content, notice.url].join("\n")).digest("hex").slice(0, 16);
    after["public/data/announcement-ai-metadata.json"].data = { items: { "academic:academic-abc": { summary: "공모전 모집", sourceHash } } };
    const changed = changedIndexNowUrls(buildIndexNowSnapshot(before), buildIndexNowSnapshot(after));
    expect(changed).toContain(`${origin}/academic/competitions`);
    expect(changed).toContain(`${origin}/en/academic/competitions`);
  });
});
