import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { getDictionary } from "@/lib/i18n";
import { MapView } from "./MapView";

vi.mock("@/lib/kakao-maps-loader", () => ({ loadKakaoMapsSdk: () => Promise.resolve(false) }));

it("offers facility access and conditional browser help without blaming cookies or developer settings", async () => {
  const text = getDictionary("ko").pages.map;
  render(<MapView />);
  expect(await screen.findByText(text.unavailableMessage)).toBeVisible();
  expect(screen.queryByText(/Kakao Maps 설정/)).not.toBeInTheDocument();
  const help = screen.getByText(text.unavailableBrowserHelp);
  expect(help).not.toBeVisible();
  fireEvent.click(screen.getByText(text.unavailableHelp));
  expect(help).toBeVisible();
  expect(help).toHaveTextContent("쿠키·사이트 데이터 제한을 사용 중이라면");
});
