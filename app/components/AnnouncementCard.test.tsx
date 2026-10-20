import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import type { Announcement } from "@/types";
import { getDictionary } from "@/lib/i18n";
import { AnnouncementCard } from "./AnnouncementCard";
import { HomeNoticeCard } from "./HomeNoticeCard";
import { LocaleProvider } from "./LocaleProvider";
import { ClientLocaleProvider } from "./LocaleContext";

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

const summarizedAnnouncement: Announcement = {
  ...announcement,
  aiSummary: {
    summary: "테스트 요약 내용",
    target: "전체 재학생",
    deadline: "2026-10-31",
    requiredAction: "신청서 제출",
    keywords: ["신청"],
    importance: "normal",
    confidence: "high",
    generatedAt: "2026-10-14T00:00:00Z",
    sourceHash: "test",
  },
};

it("uses the category label from the current provider", () => {
  const dictionary = getDictionary("en");
  render(
    <ClientLocaleProvider locale="ko" dictionary={dictionary}>
      <AnnouncementCard announcement={announcement} />
    </ClientLocaleProvider>,
  );
  expect(screen.getByText(dictionary.categories.academic)).toBeInTheDocument();
});

it("keeps the original notice as the only link when no AI summary is available", () => {
  const dictionary = getDictionary("ko");
  const { container } = render(<AnnouncementCard announcement={announcement} href={announcement.url} external />);
  const original = screen.getByRole("link", { name: `${announcement.title} ${dictionary.labels.notice}` });

  expect(original).toHaveAttribute("href", announcement.url);
  expect(original).toHaveAttribute("target", "_blank");
  expect(original).toHaveAttribute("rel", "noopener noreferrer");
  expect(screen.getAllByRole("link")).toHaveLength(1);
  expect(screen.queryByRole("button")).not.toBeInTheDocument();
  expect(container.querySelector("a a")).toBeNull();
  original.focus();
  expect(original).toHaveFocus();
});

it("opens the full AI summary without an additional summary detail link", () => {
  const labels = getDictionary("ko").labels.aiSummaryDetails;
  render(<AnnouncementCard announcement={summarizedAnnouncement} href={announcement.url} external />);

  const summary = screen.getByRole("button", { name: labels.open });
  expect(screen.getAllByRole("link")).toHaveLength(1);
  expect(screen.queryByText("요약 상세")).not.toBeInTheDocument();
  expect(summary).toHaveClass("pointer-events-auto");
  summary.focus();
  expect(summary).toHaveFocus();
  fireEvent.click(summary);
  expect(screen.getByRole("dialog", { name: labels.title })).toHaveTextContent("신청서 제출");
});

it("keeps the localized full AI summary viewer on home announcement previews", () => {
  const labels = getDictionary("en").labels.aiSummaryDetails;
  render(
    <LocaleProvider locale="en">
      <HomeNoticeCard notice={{ type: "announcement", data: summarizedAnnouncement }} />
    </LocaleProvider>,
  );
  expect(screen.getAllByRole("link")).toHaveLength(1);
  expect(screen.queryByText("Summary details")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: labels.open }));
  expect(screen.getByRole("dialog", { name: labels.title })).toHaveTextContent("신청서 제출");
});
