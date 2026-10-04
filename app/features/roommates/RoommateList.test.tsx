import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RoommateList from "./RoommateList";

vi.mock("next/navigation", () => ({ usePathname: () => window.location.pathname, useSearchParams: () => new URLSearchParams(window.location.search) }));
vi.mock("@tanstack/react-query", () => ({ useInfiniteQuery: () => ({
  isPending: false, error: null, hasNextPage: false,
  data: { pages: [{ items: [{ id: "sample", dorm: "eden", roomSize: 3, roommatesNeeded: 1, nickname: "student", status: "recruiting", stayStart: "2026-10-01", stayEnd: "2026-12-31", recruitUntil: "2099-12-31", habits: { bedtime: "before22", wakeTime: "6to8", cleaning: "regular", calls: "outside", smoking: "nonsmoker" } }] }] },
}) }));

describe("roommate list filters and cards", () => {
  it("initializes the form from the URL, updates history and clears an old cursor on apply/reset", () => {
    window.history.replaceState(null, "", "/en/campus/roommates?dorm=eden&roomSize=3&cursor=old-page");
    const view = render(<RoommateList />);
    expect(screen.getByLabelText("기숙사")).toHaveValue("eden"); expect(screen.getByLabelText("인실")).toHaveValue("3");
    fireEvent.change(screen.getByLabelText("기숙사"), { target: { value: "sion" } });
    fireEvent.click(screen.getByRole("button", { name: "조건 적용" }));
    expect(window.location.pathname).toBe("/en/campus/roommates"); expect(new URLSearchParams(window.location.search).get("dorm")).toBe("sion"); expect(window.location.search).not.toContain("cursor");
    view.rerender(<RoommateList />);
    fireEvent.click(screen.getByRole("button", { name: "초기화" })); expect(window.location.search).toBe("");
    // Next's URL hooks update on history navigation; rerender supplies the restored URL in this hook mock.
    window.history.replaceState(null, "", "/en/campus/roommates?dorm=eden&roomSize=3"); view.rerender(<RoommateList />);
    expect(screen.getByLabelText("기숙사")).toHaveValue("eden"); expect(screen.getByLabelText("인실")).toHaveValue("3");
  });
  it("shows at most four readable living-habit tags on a card", () => {
    window.history.replaceState(null, "", "/campus/roommates"); render(<RoommateList />);
    const tags = within(screen.getByRole("list", { name: "생활습관" })).getAllByRole("listitem");
    expect(tags).toHaveLength(4); expect(tags[0]).toHaveTextContent("취침: 22시 이전"); expect(tags[3]).toHaveTextContent("실내 통화: 밖에서");
  });
});
