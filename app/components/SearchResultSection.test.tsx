import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { getDictionary } from "@/lib/i18n";
import { SearchResultSection } from "./SearchResultSection";

it("links even a short preview to the fully filtered list", () => {
  const dictionary = getDictionary("ko");
  render(
    <SearchResultSection
      searchQuery="scholarship"
      categorizedResults={{
        academicAnnouncement: {
          label: "Academic",
          linkPath: "/academic/announcements",
          items: [{
            id: "notice-1",
            title: "Scholarship application",
            author: "Office",
            date: "2026.09.28",
            category: "academic",
            content: "",
            views: 0,
            isImportant: false,
          }],
        },
        phoneNumbers: {
          label: "Contacts",
          linkPath: "/campus/phone",
          items: [],
        },
      }}
    />,
  );

  expect(screen.getByRole("heading", { level: 2, name: `Academic 1 ${dictionary.search.previewLabel}` })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: `${dictionary.search.viewAll} →` })).toHaveAttribute(
    "href",
    "/academic/announcements?search=scholarship",
  );
  expect(screen.getByRole("link", { name: `Contacts ${dictionary.search.viewAll} →` })).toHaveAttribute(
    "href",
    "/campus/phone?search=scholarship",
  );
});
