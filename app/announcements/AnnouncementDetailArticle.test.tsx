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
  url: "https://example.invalid/legacy-source",
};

it("shows UISP original content without rendering a legacy source URL", () => {
  render(<AnnouncementDetailArticle announcement={announcement} locale="ko" sourceContent={<p>공식 게시글 본문</p>} />);
  const text = getDictionary("ko").pages.announcements;
  expect(screen.queryByText(text.views)).not.toBeInTheDocument();
  expect(screen.getByText("공식 게시글 본문")).toBeVisible();
  expect(screen.queryByText(text.detailContentFallback)).not.toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

it("shows a view count of zero when the source provides it", () => {
  render(<AnnouncementDetailArticle announcement={{ ...announcement, views: 0 }} locale="ko" />);
  expect(screen.getByText(getDictionary("ko").pages.announcements.views)).toBeVisible();
  expect(screen.getByText("0")).toBeVisible();
});

it("retains the original link for announcements from other sources", () => {
  render(<AnnouncementDetailArticle announcement={{ ...announcement, category: "academic" }} locale="ko" />);
  expect(screen.getByRole("link", { name: getDictionary("ko").pages.announcements.originalLink }))
    .toHaveAttribute("href", announcement.url);
});
