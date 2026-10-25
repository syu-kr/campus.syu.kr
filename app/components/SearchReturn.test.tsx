import { expect, it } from "vitest";
import { parseSearchReturn } from "./SearchReturn";

it("accepts only same-origin search result contexts", () => {
  const context = { url: "/en?search=library", scrollY: 320, result: "/en/campus/library" };
  expect(parseSearchReturn(JSON.stringify(context), "https://campus.syu.kr")).toEqual(context);
  for (const invalid of [{ ...context, url: "https://evil.example/?search=a" }, { ...context, result: "javascript:alert(1)" }, { ...context, scrollY: -1 }, { ...context, url: "/campus/map?search=a" }, { ...context, url: "/?search= " }]) {
    expect(parseSearchReturn(JSON.stringify(invalid), "https://campus.syu.kr")).toBeNull();
  }
  expect(parseSearchReturn("invalid", "https://campus.syu.kr")).toBeNull();
});
