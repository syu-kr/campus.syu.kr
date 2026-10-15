import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n";
import { SearchResultCard } from "./SearchResultCard";
import { LocaleProvider } from "./LocaleProvider";

it("displays both phone numbers with a comma and offers separate call links", () => {
  const dictionary = getDictionary("ko");
  render(<SearchResultCard item={{
    department: "교목처 교목팀",
    phone: "02-3399-3328 02-3399-3334",
    phoneNumbers: ["02-3399-3328", "02-3399-3334"],
  }} />);

  expect(screen.getByText("02-3399-3328").closest("p"))
    .toHaveTextContent("02-3399-3328, 02-3399-3334");
  fireEvent.click(screen.getByRole("button", { name: `교목처 교목팀 ${dictionary.pages.phone.call}` }));
  expect(screen.getByRole("link", { name: "02-3399-3328" })).toHaveAttribute("href", "tel:0233993328");
  expect(screen.getByRole("link", { name: "02-3399-3334" })).toHaveAttribute("href", "tel:0233993334");
});

it("updates a different department from one number to three and back to one", () => {
  const department = "테스트 부서";
  const dictionary = getDictionary("ko");
  const { rerender } = render(<SearchResultCard item={{ department, phone: "02-1234-5678" }} />);
  const callLabel = `${department} ${dictionary.pages.phone.call}`;
  expect(screen.getByRole("link", { name: callLabel })).toHaveAttribute("href", "tel:0212345678");

  const numbers = ["031-123-4567", "010-9876-5432", "051-987-6543"];
  rerender(<SearchResultCard item={{ department, phone: numbers.join(" / ") }} />);
  expect(screen.getByText(numbers[0]).closest("p")).toHaveTextContent(numbers.join(", "));
  fireEvent.click(screen.getByRole("button", { name: callLabel }));
  for (const number of numbers) {
    expect(screen.getByRole("link", { name: number }))
      .toHaveAttribute("href", `tel:${number.replace(/\D/g, "")}`);
  }
  fireEvent.click(screen.getByRole("button", { name: dictionary.labels.closeModal }));
  rerender(<SearchResultCard item={{ department, phone: "02-5555-6666", phoneNumbers: ["02-5555-6666"] }} />);
  expect(screen.getByRole("link", { name: callLabel })).toHaveAttribute("href", "tel:0255556666");
  expect(screen.queryByText(numbers[0])).not.toBeInTheDocument();
});

it("keeps original announcement links and exposes separate localized summary detail links", () => {
  const title = "검색 테스트 공지";
  const { container } = render(
    <LocaleProvider locale="en">
      <SearchResultCard item={{
        id: "search/123",
        title,
        content: "검색 내용",
        category: "campus",
        date: "2026-10-14",
        author: "학생처",
        views: 0,
        isImportant: false,
        url: "https://www.syu.ac.kr/notice/123",
      }} />
    </LocaleProvider>,
  );
  expect(screen.getByRole("link", { name: title })).toHaveAttribute("target", "_blank");
  const detail = screen.getByRole("link", { name: `${title} Summary details` });
  expect(detail).toHaveAttribute("href", "/en/announcements/campus/search%2F123");
  expect(detail).toHaveClass("pointer-events-auto");
  expect(container.querySelector("a a")).toBeNull();
  detail.focus();
  expect(detail).toHaveFocus();
});
