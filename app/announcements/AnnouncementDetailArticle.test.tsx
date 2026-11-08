import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { getDictionary } from "@/lib/i18n";
import type { Announcement } from "@/types";
import { AnnouncementDetailArticle } from "./AnnouncementDetailArticle";

vi.mock("@/app/components/ContentTranslation", () => ({
  useContentTranslation: () => ({ lang: "ko", text: (_key: string, fallback: string) => fallback }),
}));

const announcement: Announcement = {
  id: "uisp-744",
  title: "프로그램 안내",
  content: "",
  category: "uisp",
  date: "2026.11.06",
  author: "대학혁신지원사업단",
  isImportant: false,
  url: "http://uisp-origin.example.invalid/bbs/board.php?bo_table=notice&wr_id=744",
};

it("omits unavailable view counts and preserves the original notice link", () => {
  render(<AnnouncementDetailArticle announcement={announcement} locale="ko" />);
  const text = getDictionary("ko").pages.announcements;
  expect(screen.queryByText(text.views)).not.toBeInTheDocument();
  expect(screen.getByRole("link", { name: text.originalLink })).toHaveAttribute("href", announcement.url);
});

it("shows a view count of zero when the source provides it", () => {
  render(<AnnouncementDetailArticle announcement={{ ...announcement, views: 0 }} locale="ko" />);
  expect(screen.getByText(getDictionary("ko").pages.announcements.views)).toBeVisible();
  expect(screen.getByText("0")).toBeVisible();
});
