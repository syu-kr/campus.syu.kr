import { vi, type Mock } from "vitest";

export function mockKakaoMaps() {
  const markers: KakaoMarker[] = [];
  const windows: {
    open: Mock<(map: KakaoMap, marker: KakaoMarker) => void>;
    close: Mock<() => void>;
    getMap: () => KakaoMap | null;
  }[] = [];
  const frames = new Map<number, FrameRequestCallback>();
  let frameId = 0;
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    frames.set(++frameId, callback);
    return frameId;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  const map = {
    relayout: vi.fn(), setCenter: vi.fn(), setLevel: vi.fn(),
    panTo: vi.fn(), setBounds: vi.fn(),
  };
  const event = { addListener: vi.fn(), removeListener: vi.fn() };
  window.kakao = { maps: {
    Map: class { constructor() { return map; } },
    LatLng: class { constructor(public lat: number, public lng: number) {} },
    Marker: class {
      constructor({ position }: { position: KakaoLatLng }) {
        const marker = { setMap: vi.fn(), getPosition: vi.fn(() => position) };
        markers.push(marker);
        return marker;
      }
    },
    InfoWindow: class {
      constructor() {
        let currentMap: KakaoMap | null = null;
        const infoWindow = {
          open: vi.fn((nextMap: KakaoMap, marker: KakaoMarker) => {
            void marker;
            currentMap = nextMap;
          }),
          close: vi.fn(() => { currentMap = null; }),
          getMap: () => currentMap,
        };
        windows.push(infoWindow);
        return infoWindow;
      }
    },
    MarkerImage: class {}, Size: class {}, Point: class {},
    LatLngBounds: class { extend = vi.fn(); }, event,
  } as unknown as KakaoMapsNamespace };
  return {
    markers, windows, map, event,
    flushFrames() {
      const pending = [...frames.values()];
      frames.clear();
      pending.forEach((callback) => callback(0));
    },
    pendingFrames: () => frames.size,
  };
}
