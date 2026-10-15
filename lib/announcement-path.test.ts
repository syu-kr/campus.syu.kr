import { expect, it } from "vitest";
import { getAnnouncementDetailPath } from "./announcement-path";

it("keeps notice IDs in one encoded path segment", () => {
  expect(getAnnouncementDetailPath("academic", "학사/123?source=#"))
    .toBe("/announcements/academic/%ED%95%99%EC%82%AC%2F123%3Fsource%3D%23");
  expect(getAnnouncementDetailPath("sw", "123"))
    .toBe("/announcements/sw/123");
});
