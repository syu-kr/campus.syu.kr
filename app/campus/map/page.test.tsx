import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockKakaoMaps } from "@/tests/kakao-maps-mock";
import { buildings } from "./lib/mapData";
import MapPage from "./page";

vi.mock("@/lib/kakao-maps-loader", () => ({ loadKakaoMapsSdk: () => Promise.resolve(true) }));
vi.mock("./components/FacilitySearch", () => ({
  FacilitySearch: ({ onSelect }: { onSelect: (id: string) => void }) => <button onClick={() => onSelect(buildings[0].id)}>Select building</button>,
}));
vi.mock("./components/FacilityPanel", () => ({ FacilityPanel: () => null }));
afterEach(() => { delete window.kakao; vi.unstubAllGlobals(); });

describe("Campus map marker lifecycle", () => {
  it("keeps all markers on building selection and repeated clicks, and releases their windows and listeners", async () => {
    const sdk = mockKakaoMaps();
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    const { unmount } = render(<MapPage />);
    await waitFor(() => expect(sdk.markers).toHaveLength(buildings.length));
    act(() => sdk.flushFrames());
    sdk.windows.forEach((infoWindow) => infoWindow.close.mockClear());
    fireEvent.click(screen.getByRole("button", { name: "Select building" }));
    expect(sdk.markers).toHaveLength(buildings.length);
    expect(sdk.windows[0].open).toHaveBeenLastCalledWith(sdk.map, sdk.markers[0]);
    expect(sdk.windows[0].close).not.toHaveBeenCalled();
    const firstMarkerClick = sdk.event.addListener.mock.calls[0][2] as () => void;
    act(() => firstMarkerClick());
    expect(sdk.markers).toHaveLength(buildings.length);
    expect(sdk.windows[0].close).not.toHaveBeenCalled();
    unmount();
    sdk.markers.forEach((marker) => expect(marker.setMap).toHaveBeenLastCalledWith(null));
    sdk.windows.forEach((infoWindow) => expect(infoWindow.close).toHaveBeenCalled());
    expect(sdk.event.removeListener.mock.calls).toEqual(sdk.event.addListener.mock.calls);
    expect(sdk.pendingFrames()).toBe(0);
  });
});
