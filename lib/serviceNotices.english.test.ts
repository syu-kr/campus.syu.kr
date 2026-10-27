// @vitest-environment node
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { expect, it } from "vitest";
import { getAllServiceNotices, getServiceNoticeBySlug } from "./serviceNotices";

const dir = path.join(process.cwd(), "public", "service-notices");

it("serves nineteen English notices with the same source identities and original order", async () => {
  const originals = await getAllServiceNotices();
  const english = await getAllServiceNotices("en");
  expect(originals).toHaveLength(19);
  expect(english).toHaveLength(19);
  const identity = (notice: typeof english[number]) => ({ id: notice.id, slug: notice.slug, date: notice.date, author: notice.author });
  expect(english.map(identity)).toEqual(originals.map(identity));
  expect(english.every(notice => notice.lang === "en" && !/[가-힣]/.test(notice.title + notice.excerpt))).toBe(true);
  const detail = await getServiceNoticeBySlug("017-roommate-board", "en");
  expect(detail?.content).toContain("### Article 9. Governing Law and Jurisdiction");
  expect(detail?.content).toContain("## Current Terms preserved in English");
  expect(detail?.content).toContain("### Article 7. Changes and Governing Law");
  expect(detail?.content).toContain("November 4, 2026");
  expect(detail?.content).not.toMatch(/[가-힣]/);
});

it("binds all eighteen complete English variants to their source and preserves every Markdown link destination", async () => {
  const variants = (await readdir(path.join(dir, "en"))).filter(file => file.endsWith(".md"));
  expect(variants).toHaveLength(18);
  const links = (value: string) => [...value.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)].map(match => match[1]).sort();
  for (const file of variants) {
    const original = (await readFile(path.join(dir, file), "utf8")).replace(/\r\n/g, "\n");
    const variant = await readFile(path.join(dir, "en", file), "utf8");
    const hash = createHash("sha256").update(original).digest("hex");
    expect(variant, file).toContain(`sourceSha256: ${hash}`);
    expect(variant, file).not.toContain("PENDING");
    expect(variant, file).not.toMatch(/[가-힣]/);
    expect(links(variant), file).toEqual(links(original));
    expect([...variant.matchAll(/^#{1,6}\s/gm)].length, file).toBe([...original.matchAll(/^#{1,6}\s/gm)].length);
    expect((await getServiceNoticeBySlug(file.slice(0, -3), "en"))?.lang, file).toBe("en");
  }
});
