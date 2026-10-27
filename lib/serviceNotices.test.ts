import path from "node:path";
import { createHash } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import { getAllServiceNotices, getServiceNoticeBySlug } from "./serviceNotices";
import { getServiceNoticePath, getRepositoryServiceNoticeBySlug, readRepositoryManagedContent } from "./service-notice-repository";

const files = vi.hoisted(() => ({ readdir: vi.fn(), readFile: vi.fn() }));
vi.mock("node:fs/promises", () => ({ ...files, default: files }));

beforeEach(() => { files.readdir.mockReset(); files.readFile.mockReset(); });

it("reads markdown asynchronously with consistent list/detail metadata and descending dates", async () => {
  files.readdir.mockResolvedValue(["001-old.md", "002-new.md", "ignored.json"]);
  files.readFile.mockImplementation(async (file: string) => path.basename(file) === "002-new.md"
    ? "---\r\ntitle: '새 공지'\r\ndate: 2026-10-05\r\nauthor: 운영팀\r\ndescription: '**중요** [안내](https://example.test)'\r\n---\r\n# 본문\r\n"
    : "---\ndate: 2026-10-01\n---\n# 이전 공지\n- 안내\n");
  const notices = await getAllServiceNotices();
  expect(notices.map((notice) => notice.slug)).toEqual(["002-new", "001-old"]);
  expect(notices[0]).toEqual({ id: "002", slug: "002-new", title: "새 공지", date: "2026-10-05", author: "운영팀", lang: "ko", excerpt: "중요 안내", description: "중요 안내" });
  expect(notices[1]).toMatchObject({ title: "무제", author: "시스템", excerpt: "이전 공지 안내" });
  expect(await getServiceNoticeBySlug("002-new")).toEqual({ ...notices[0], content: "# 본문\n" });
  expect(files.readFile).toHaveBeenCalledTimes(3);
  expect(files.readFile.mock.calls.every(([, encoding]) => encoding === "utf-8")).toBe(true);
});

it("preserves excerpt limits and fallback metadata for files without frontmatter", async () => {
  const text = "가".repeat(350);
  files.readFile.mockResolvedValue(text);
  const notice = await getServiceNoticeBySlug("003-long");
  expect(notice).toMatchObject({ id: "003", title: "무제", author: "시스템", lang: "ko", content: text, excerpt: `${"가".repeat(300)}...`, description: `${"가".repeat(160)}...` });
  expect(notice?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

it.each([[undefined, "ko"], ["ko", "ko"], ["en", "en"], ["ja", "ko"], ["en-US", "ko"], ["EN", "ko"]])("reads only supported source language %s and keeps list/detail consistent", async (lang, expected) => {
  files.readdir.mockResolvedValue(["012-english-version-beta.md"]);
  files.readFile.mockResolvedValue(`---\ntitle: English Version Now Available\ndate: 2026-06-16\n${lang ? `lang: ${lang}\n` : ""}---\nHello from SYU CAMPUS.\n`);
  const [notice] = await getAllServiceNotices();
  expect(notice.lang).toBe(expected);
  expect((await getServiceNoticeBySlug("012-english-version-beta"))?.lang).toBe(expected);
  expect(notice.excerpt).toBe("Hello from SYU CAMPUS.");
});

it("returns empty results only for missing files and does not hide permission errors", async () => {
  files.readdir.mockRejectedValue({ code: "ENOENT" });
  files.readFile.mockRejectedValue({ code: "ENOENT" });
  expect(await getAllServiceNotices()).toEqual([]);
  expect(await getServiceNoticeBySlug("missing")).toBeNull();
  const error = Object.assign(new Error("Permission denied"), { code: "EACCES" });
  files.readdir.mockRejectedValue(error); files.readFile.mockRejectedValue(error);
  await expect(getAllServiceNotices()).rejects.toBe(error);
  await expect(getServiceNoticeBySlug("missing")).rejects.toBe(error);
});

it.each(["../secret", "..\\secret", "nested/file", "nested\\file", "", "%2e%2e", "%2fsecret", "%5csecret", "notice.md", "notice\0", "공지", "/absolute", "C:\\notice"])("rejects invalid slug %s before file access in either locale", async (slug) => {
  for (const locale of ["ko", "en"] as const) {
    expect(getServiceNoticePath(slug, locale)).toBeNull();
    expect(await getServiceNoticeBySlug(slug, locale)).toBeNull();
    expect(await getRepositoryServiceNoticeBySlug(slug, locale)).toBeNull();
  }
  expect(files.readFile).not.toHaveBeenCalled();
});

it.each(["ko", "en"] as const)("resolves valid slugs only inside the fixed %s notice directory", locale => {
  const directory = path.resolve(process.cwd(), "public", "service-notices", ...(locale === "en" ? ["en"] : []));
  const file = getServiceNoticePath("019-Test-2026", locale)!;
  expect(path.dirname(file)).toBe(directory);
  expect(file.startsWith(directory + path.sep)).toBe(true);
  expect(path.basename(file)).toBe("019-Test-2026.md");
  expect(getServiceNoticePath("019-Test-2026")).toBe(getServiceNoticePath("019-Test-2026", "ko"));
});

it("selects a matching reviewed English variant without changing source identity or pagination count", async () => {
  const source = "---\ntitle: 원문 제목\ndate: 2026-10-04\nauthor: 원문 작성자\n---\n# 원문 내용\n";
  const hash = createHash("sha256").update(source).digest("hex");
  files.readdir.mockResolvedValue(["017-roommate-board.md", "en", "ignored.json"]);
  files.readFile.mockImplementation(async (file: string) => path.basename(path.dirname(file)) === "en"
    ? `---\ntitle: Reviewed English\ndate: 2099-01-01\nauthor: Different author\nlang: en\nsourceSha256: ${hash}\ndescription: English excerpt\n---\n# Complete English content\n`
    : source.replace(/\n/g, "\r\n"));
  const [original] = await getAllServiceNotices();
  const english = await getAllServiceNotices("en");
  expect(english).toHaveLength(1);
  expect(english[0]).toEqual({ ...original, title: "Reviewed English", lang: "en", excerpt: "English excerpt", description: "English excerpt" });
  expect(await getServiceNoticeBySlug("017-roommate-board", "en")).toEqual({ ...english[0], content: "# Complete English content\n" });
  expect(files.readFile).toHaveBeenCalledWith(getServiceNoticePath("017-roommate-board", "en"), "utf-8");
  expect((await getServiceNoticeBySlug("017-roommate-board"))?.content).toBe("# 원문 내용\n");
});

it("falls back to original content when a reviewed variant is missing, stale, incomplete or not English", async () => {
  const source = "---\ntitle: 수정된 공지\ndate: 2026-10-04\n---\n# 수정된 전체 원문\n";
  const matchingHash = createHash("sha256").update(source).digest("hex");
  let variant: string | undefined;
  files.readFile.mockImplementation(async (file: string) => {
    if (path.basename(path.dirname(file)) !== "en") return source;
    if (variant === undefined) throw Object.assign(new Error("Missing variant"), { code: "ENOENT" });
    return variant;
  });
  const original = await getServiceNoticeBySlug("017-roommate-board");
  for (const candidate of [
    undefined,
    "---\ntitle: Old English\nlang: en\nsourceSha256: " + "0".repeat(64) + "\n---\nOld content",
    `---\ntitle: Wrong language\nlang: ko\nsourceSha256: ${matchingHash}\n---\nContent`,
    `---\nlang: en\nsourceSha256: ${matchingHash}\n---\nContent`,
    `---\ntitle: Empty content\nlang: en\nsourceSha256: ${matchingHash}\n---\n`,
  ]) {
    variant = candidate;
    expect(await getServiceNoticeBySlug("017-roommate-board", "en")).toEqual(original);
  }
});

it("does not need a variant for an English source and rejects English traversal before reading", async () => {
  files.readFile.mockResolvedValue("---\ntitle: Original English\nlang: en\n---\nFull English body\n");
  expect((await getServiceNoticeBySlug("012-english-version-beta", "en"))?.lang).toBe("en");
  expect(files.readFile).toHaveBeenCalledTimes(1);
  files.readFile.mockClear();
  expect(await getServiceNoticeBySlug("../en/secret", "en")).toBeNull();
  expect(files.readFile).not.toHaveBeenCalled();
});
it("refuses to import an existing stale reviewed English file instead of silently dropping it", async () => {
  files.readdir.mockResolvedValue(["001-test.md"]);
  files.readFile.mockImplementation(async (file: string) => path.basename(path.dirname(file)) === "en"
    ? `---\ntitle: Old English\nlang: en\nsourceSha256: ${"0".repeat(64)}\n---\nOld English body\n`
    : "---\ntitle: Current Korean\ndate: 2026-10-26\nauthor: Original author\n---\n한국어 원문\n");
  await expect(readRepositoryManagedContent(true)).rejects.toThrow("Reviewed English does not match source");
  expect(files.readFile).toHaveBeenCalledWith(getServiceNoticePath("001-test", "en"), "utf8");
});

it("keeps a missing English variant optional during a strict import", async () => {
  files.readdir.mockResolvedValue(["001-test.md"]);
  files.readFile.mockImplementation(async (file: string) => {
    if (file === getServiceNoticePath("001-test", "en")) throw Object.assign(new Error("Missing variant"), { code: "ENOENT" });
    return "---\ntitle: Current Korean\ndate: 2026-10-26\nauthor: Original author\n---\n한국어 원문\n";
  });
  const [notice] = await readRepositoryManagedContent(true);
  expect(notice.published).toMatchObject({ slug: "001-test", title: "Current Korean", content: "한국어 원문\n" });
  expect(notice.published).not.toHaveProperty("english");
});

it("propagates an English file permission error instead of hiding it as a missing translation", async () => {
  const error = Object.assign(new Error("Permission denied"), { code: "EACCES" });
  files.readFile.mockImplementation(async (file: string) => {
    if (file === getServiceNoticePath("001-test", "en")) throw error;
    return "---\ntitle: Current Korean\ndate: 2026-10-26\n---\n한국어 원문\n";
  });
  await expect(getRepositoryServiceNoticeBySlug("001-test", "en")).rejects.toBe(error);
});
