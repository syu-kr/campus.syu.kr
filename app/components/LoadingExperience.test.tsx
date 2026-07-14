import { render, screen } from "@testing-library/react";
import { useLinkStatus } from "next/link";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDictionary } from "@/lib/i18n";
import { NavigationPendingIndicator } from "./NavigationPendingIndicator";
import { HomePageSkeleton } from "./PageLoadingSkeletons";

vi.mock("next/link", () => ({
  useLinkStatus: vi.fn(),
}));

const mockedUseLinkStatus = vi.mocked(useLinkStatus);

describe("loading experience", () => {
  beforeEach(() => {
    mockedUseLinkStatus.mockReturnValue({ pending: false });
  });

  it("keeps navigation feedback silent while a link is idle", () => {
    const { container } = render(<NavigationPendingIndicator />);

    expect(
      container.querySelector(".navigation-pending-indicator"),
    ).toHaveAttribute("data-pending", "false");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("announces and reveals feedback while a link is pending", () => {
    mockedUseLinkStatus.mockReturnValue({ pending: true });

    const { container } = render(<NavigationPendingIndicator />);

    expect(
      container.querySelector(".navigation-pending-indicator"),
    ).toHaveAttribute("data-pending", "true");
    expect(screen.getByRole("status")).toHaveTextContent(
      getDictionary("ko").errorBoundary.loading,
    );
  });

  it("exposes one localized status while page skeletons stay decorative", () => {
    const { container } = render(<HomePageSkeleton />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("status")).toHaveTextContent(
      getDictionary("ko").errorBoundary.loading,
    );
    expect(container.querySelectorAll('[aria-hidden="true"]').length).toBeGreaterThan(
      0,
    );
  });
});
