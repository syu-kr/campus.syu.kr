import path from "node:path";
import { beforeEach, expect, it, vi } from "vitest";
import { getAllServiceNotices, getServiceNoticeBySlug } from "./serviceNotices";

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
  expect(notices[0]).toEqual({ id: "002", slug: "002-new", title: "새 공지", date: "2026-10-05", author: "운영팀", excerpt: "중요 안내", description: "중요 안내" });
  expect(notices[1]).toMatchObject({ title: "무제", author: "시스템", excerpt: "이전 공지 안내" });
  expect(await getServiceNoticeBySlug("002-new")).toEqual({ ...notices[0], content: "# 본문\n" });
  expect(files.readFile).toHaveBeenCalledTimes(3);
  expect(files.readFile.mock.calls.every(([, encoding]) => encoding === "utf-8")).toBe(true);
});

it("preserves excerpt limits and fallback metadata for files without frontmatter", async () => {
  const text = "가".repeat(350);
  files.readFile.mockResolvedValue(text);
  const notice = await getServiceNoticeBySlug("003-long");
  expect(notice).toMatchObject({ id: "003", title: "무제", author: "시스템", content: text, excerpt: `${"가".repeat(300)}...`, description: `${"가".repeat(160)}...` });
  expect(notice?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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

it.each(["../secret", "nested/file", "nested\\file", "", "%2e%2e", "notice.md"])("rejects invalid slug %s before file access", async (slug) => {
  expect(await getServiceNoticeBySlug(slug)).toBeNull();
  expect(files.readFile).not.toHaveBeenCalled();
});
