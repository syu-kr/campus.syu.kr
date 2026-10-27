import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getDictionary } from "@/lib/i18n";
import { MapView } from "./MapView";
import { loadKakaoMapsSdk } from "@/lib/kakao-maps-loader";
import { mockKakaoMaps } from "@/tests/kakao-maps-mock";

vi.mock("@/lib/kakao-maps-loader", () => ({ loadKakaoMapsSdk: vi.fn(async () => false) }));
afterEach(() => { vi.mocked(loadKakaoMapsSdk).mockReset().mockResolvedValue(false);delete window.kakao;vi.unstubAllGlobals(); });

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

it("offers a same-page retry and preserves focus on a stable progress status", async () => {
  const text = getDictionary("ko").pages.map;
  vi.mocked(loadKakaoMapsSdk).mockResolvedValueOnce(false).mockImplementationOnce(async () => { mockKakaoMaps();return true; });
  render(<MapView />);
  fireEvent.click(await screen.findByRole("button", { name: text.retry }));
  expect(screen.getByRole("status")).toHaveFocus();
  await screen.findByText(text.selectBuilding);
  expect(screen.queryByRole("button", { name: text.retry })).toBeNull();
});
