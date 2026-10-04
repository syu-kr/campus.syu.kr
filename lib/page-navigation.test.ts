import { describe, expect, it } from "vitest";

import { getParentPageHref } from "./page-navigation";

describe("getParentPageHref", () => {
  it.each([null, "/", "/en", "/en/"])("keeps home without a back link: %s", (path) => {
    expect(getParentPageHref(path)).toBeNull();
  });

  it.each([
    ["/academic", "/"],
    ["/campus", "/"],
    ["/more", "/"],
    ["/announcements", "/"],
    ["/academic/timetable", "/academic"],
    ["/academic/graduation", "/academic"],
    ["/campus/cafeteria", "/campus"],
    ["/campus/roommates", "/campus"],
    ["/campus/campus-tips/suggest", "/campus/campus-tips"],
    ["/more/privacy", "/more"],
    ["/more/meet", "/more"],
    ["/more/meet/invitation", "/more/meet"],
    ["/service/notices", "/more"],
    ["/service/notices/update", "/service/notices"],
    ["/announcements/academic/123", "/announcements"],
    ["/terms", "/more"],
    ["/privacy", "/more"],
  ])("returns a real parent for %s", (path, parent) => {
    expect(getParentPageHref(path)).toBe(parent);
    expect(getParentPageHref(`/en${path}`)).toBe(parent);
    expect(getParentPageHref(`${path}/`)).toBe(parent);
  });

  it.each([
    ["/campus/roommates/verify", "/campus"],
    ["/campus/roommates/verify/finish", "/campus/roommates/verify"],
    ["/campus/roommates/new", "/campus/roommates"],
    ["/campus/roommates/me", "/campus/roommates"],
    ["/campus/roommates/post-id", "/campus/roommates"],
  ])("keeps the roommate return route safe for direct entry: %s", (path, parent) => {
    expect(getParentPageHref(path)).toBe(parent);
    expect(getParentPageHref(`/en${path}`)).toBe(parent);
  });
});
