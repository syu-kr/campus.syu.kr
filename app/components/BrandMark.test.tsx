import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { BrandMark } from "./BrandMark";

describe("approved smiling bean brand mark", () => {
  it("keeps header and footer masks independent and the mark decorative", () => {
    const container = document.createElement("div");
    container.innerHTML = renderToStaticMarkup(<><BrandMark className="header-mark" /><BrandMark className="footer-mark" /></>);
    const marks = Array.from(container.querySelectorAll("svg"));
    const maskIds = marks.map(mark => mark.querySelector("mask")!.id);
    expect(new Set(maskIds).size).toBe(2);
    marks.forEach((mark, index) => {
      expect(mark).toHaveAttribute("aria-hidden", "true");
      expect(mark).toHaveAttribute("focusable", "false");
      expect(mark.querySelector(":scope > path")).toHaveAttribute("mask", `url(#${maskIds[index]})`);
    });
  });

  it.each([16, 28, 34, 64])("matches the approved vector at %ipx", async (size) => {
    const approved = await readFile(path.join(process.cwd(), "docs/design/pea-logo/blue-bean.svg"));
    const markup = renderToStaticMarkup(<BrandMark />).replace("<svg", '<svg color="#2459d4"');
    const raster = (svg: string | Buffer) => sharp(Buffer.isBuffer(svg) ? svg : Buffer.from(svg)).resize(size, size).ensureAlpha().raw().toBuffer();
    expect(await raster(markup)).toEqual(await raster(approved));
  });
});
