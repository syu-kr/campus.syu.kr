import { expect, it } from "vitest";
import { getSitePresentationRoute, getSiteSection } from "./site-presentation";

it.each([
  ["/en/announcements/academic/123", "/announcements/[category]/[id]", "/academic"],
  ["/service/notices/017-roommate-board", "/service/notices/[slug]", "/more"],
  ["/more/meet/secret", "/more/meet/[roomId]", "/more"],
  ["/campus/roommates/new", "/campus/roommates/new", "/campus"],
  ["/campus/roommates/verify/finish", "/campus/roommates/verify/finish", "/campus"],
  ["/en/campus/roommates/abc", "/campus/roommates/[postId]", "/campus"],
  ["/en", "/", "/"],
])("keeps route presentation and nav section for %s", (path, route, section) => {
  expect(getSitePresentationRoute(path)).toBe(route);
  expect(getSiteSection(path)).toBe(section);
});
