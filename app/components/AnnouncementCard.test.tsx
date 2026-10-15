import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import type { Announcement } from "@/types";
import { getDictionary } from "@/lib/i18n";
import { AnnouncementCard } from "./AnnouncementCard";
import { HomeNoticeCard } from "./HomeNoticeCard";
import { LocaleProvider } from "./LocaleProvider";

const announcement: Announcement = {
  id: "notice/123",
  title: "학사 테스트 공지",
  content: "확인할 내용",
  category: "academic",
  date: "2026-10-14",
  author: "학사지원팀",
  views: 0,
  isImportant: false,
  url: "https://www.syu.ac.kr/notice/123",
};

it("preserves the original notice click and adds a separate focusable detail link", () => {
  const dictionary = getDictionary("ko");
  const { container } = render(<AnnouncementCard announcement={announcement} href={announcement.url} external />);
  const original = screen.getByRole("link", { name: `${announcement.title} ${dictionary.labels.notice}` });
  const detail = screen.getByRole("link", { name: `${announcement.title} ${dictionary.pages.announcements.summaryDetail}` });

  expect(original).toHaveAttribute("href", announcement.url);
  expect(original).toHaveAttribute("target", "_blank");
  expect(detail).toHaveAttribute("href", "/announcements/academic/notice%2F123");
  expect(detail).not.toHaveAttribute("target");
  expect(detail).toHaveClass("pointer-events-auto");
  expect(detail.className).toContain("focus:ring-2");
  expect(container.querySelector("a a")).toBeNull();
  detail.focus();
  expect(detail).toHaveFocus();
});

it("exposes locale-correct detail links from home announcement cards", () => {
  render(
    <LocaleProvider locale="en">
      <HomeNoticeCard notice={{ type: "announcement", data: announcement }} />
    </LocaleProvider>,
  );
  expect(screen.getByRole("link", { name: `${announcement.title} Summary details` }))
    .toHaveAttribute("href", "/en/announcements/academic/notice%2F123");
});
