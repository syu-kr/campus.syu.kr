import { act, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockKakaoMaps } from "@/tests/kakao-maps-mock";
import type { BusLocation } from "@/types";
import { ShuttleMap } from "./ShuttleMap";

vi.mock("@/lib/kakao-maps-loader", () => ({ loadKakaoMapsSdk: () => Promise.resolve(true) }));
afterEach(() => { delete window.kakao; vi.unstubAllGlobals(); });

const labels = { status: "상태", schoolToStation: "역으로", stationToSchool: "학교로", unknown: "알 수 없음" };
const buses: BusLocation[] = [{ id: "bus-1", name: "셔틀", lat: "37.64", lon: "127.11", status: 1, routeid: 1 }];

describe("ShuttleMap SDK lifecycle", () => {
  it.each([null, "bus-1"])("does not reopen or pan to a dismissed window on refresh (selected=%s)", async (selectedBusId) => {
    const sdk = mockKakaoMaps();
    const { rerender } = render(<><div id="shuttle-map" /><ShuttleMap busLocations={buses} selectedBusId={selectedBusId} labels={labels} /></>);
    await waitFor(() => expect(sdk.markers).toHaveLength(1));
    act(() => sdk.flushFrames());
    const clickMarker = sdk.event.addListener.mock.calls[0][2] as () => void;
    act(() => clickMarker());
    expect(sdk.windows[0].getMap()).toBe(sdk.map);
    sdk.windows[0].close();
    expect(sdk.windows[0].getMap()).toBeNull();
    const panCount = sdk.map.panTo.mock.calls.length;
    const centerCount = sdk.map.setCenter.mock.calls.length;
    const boundsCount = sdk.map.setBounds.mock.calls.length;
    rerender(<><div id="shuttle-map" /><ShuttleMap busLocations={[{ ...buses[0], lat: "37.65" }]} selectedBusId={selectedBusId} labels={labels} /></>);
    act(() => sdk.flushFrames());
    expect(sdk.windows[1].open).not.toHaveBeenCalled();
    expect(sdk.windows[1].getMap()).toBeNull();
    expect(sdk.map.panTo).toHaveBeenCalledTimes(panCount);
    expect(sdk.map.setCenter).toHaveBeenCalledTimes(centerCount);
    expect(sdk.map.setBounds).toHaveBeenCalledTimes(boundsCount);
    const clickRefreshedMarker = sdk.event.addListener.mock.calls.at(-1)![2] as () => void;
    act(() => clickRefreshedMarker());
    expect(sdk.windows[1].getMap()).toBe(sdk.map);
    rerender(<><div id="shuttle-map" /><ShuttleMap busLocations={[{ ...buses[0], lat: "37.66" }]} selectedBusId={selectedBusId} labels={labels} /></>);
    act(() => sdk.flushFrames());
    expect(sdk.windows[2].getMap()).toBe(sdk.map);
    expect(sdk.map.panTo).toHaveBeenLastCalledWith(sdk.markers[2].getPosition());
  });

  it("keeps markers and selection across clock-only renders, then restores the selection on a position refresh", async () => {
    const sdk = mockKakaoMaps();
    const { rerender, unmount } = render(<><div id="shuttle-map" /><ShuttleMap busLocations={buses} selectedBusId="bus-1" labels={{ ...labels }} /></>);
    await waitFor(() => expect(sdk.markers).toHaveLength(1));
    act(() => sdk.flushFrames());
    const initialOpenCount = sdk.windows[0].open.mock.calls.length;
    const initialCenterCount = sdk.map.setCenter.mock.calls.length;
    rerender(<><div id="shuttle-map" /><ShuttleMap busLocations={buses} selectedBusId="bus-1" labels={{ ...labels }} /></>);
    act(() => sdk.flushFrames());
    expect(sdk.markers).toHaveLength(1);
    expect(sdk.windows[0].open).toHaveBeenCalledTimes(initialOpenCount);
    expect(sdk.windows[0].close).not.toHaveBeenCalled();
    expect(sdk.map.setCenter).toHaveBeenCalledTimes(initialCenterCount);

    const movedBuses = [{ ...buses[0], lat: "37.65" }];
    rerender(<><div id="shuttle-map" /><ShuttleMap busLocations={movedBuses} selectedBusId="bus-1" labels={{ ...labels }} /></>);
    act(() => sdk.flushFrames());
    expect(sdk.markers).toHaveLength(2);
    expect(sdk.markers[0].setMap).toHaveBeenLastCalledWith(null);
    expect(sdk.windows[0].close).toHaveBeenCalledOnce();
    expect(sdk.windows[1].open).toHaveBeenCalledWith(sdk.map, sdk.markers[1]);
    expect(sdk.map.panTo).toHaveBeenLastCalledWith(sdk.markers[1].getPosition());
    expect(sdk.map.setCenter).toHaveBeenCalledTimes(initialCenterCount);
    unmount();
    expect(sdk.markers[1].setMap).toHaveBeenLastCalledWith(null);
    expect(sdk.windows[1].close).toHaveBeenCalledOnce();
    expect(sdk.event.removeListener.mock.calls).toEqual(sdk.event.addListener.mock.calls);
    expect(sdk.pendingFrames()).toBe(0);
  });
});
