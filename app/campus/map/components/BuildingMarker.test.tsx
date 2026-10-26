import { act, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { getDictionary } from "@/lib/i18n";
import type { Building } from "../lib/mapData";
import { BuildingMarker } from "./BuildingMarker";

const translation = vi.hoisted(() => ({ name: "", request: vi.fn() }));
vi.mock("@/app/components/ContentTranslation", () => ({ useContentTranslation: (source: unknown, fields: unknown) => {
  translation.request(source, fields);return { text: (_field: string, fallback: string) => translation.name || fallback, lang: "en-x-mtfrom-ko", translated: true, controls: null };
} }));
afterEach(() => { vi.unstubAllGlobals();translation.request.mockClear();translation.name = ""; });

it("escapes translated info-window HTML and retains marker selection after translation changes", () => {
  const markers: Marker[] = [], windows: InfoWindow[] = [];
  class Marker { constructor(readonly options: { title: string }) { markers.push(this); } setMap = vi.fn(); }
  class InfoWindow { constructor(readonly options: { content: string }) { windows.push(this); } open = vi.fn();close = vi.fn(); }
  class Coordinate {}
  const addListener = vi.fn(), removeListener = vi.fn();
  vi.stubGlobal("kakao", { maps: { LatLng: Coordinate, MarkerImage: Coordinate, Size: Coordinate, Point: Coordinate, Marker, InfoWindow, event: { addListener, removeListener } } });
  const building: Building = { id: "source-building", name: "원본 건물", lat: 37, lng: 127, category: "학습", floors: [{ floor: 1, facilities: [] }] };
  translation.name = '<img src=x onerror="alert(1)"> & Building';
  const onClick = vi.fn(), onInfoWindowOpen = vi.fn(), map = {} as KakaoMap;
  const props = { building, isHighlighted: true, map, onClick, onInfoWindowOpen, locale: "en" as const, labels: getDictionary("en").pages.map };
  const view = render(<BuildingMarker {...props} />);
  expect(markers[0].options.title).toBe(translation.name);
  const html = new DOMParser().parseFromString(windows[0].options.content, "text/html");
  expect(html.querySelector("h3")?.textContent).toBe(translation.name);expect(html.querySelector("img,script")).toBeNull();expect(html.querySelector("h3")?.getAttribute("lang")).toBe("en-x-mtfrom-ko");
  expect(translation.request).toHaveBeenCalledWith({ kind: "map", id: building.id }, { name: building.name });
  act(() => addListener.mock.calls[0][2]());expect(onClick).toHaveBeenCalledExactlyOnceWith(building.id);
  translation.name = "Updated public building";view.rerender(<BuildingMarker {...props} />);
  expect(windows[0].close).toHaveBeenCalled();expect(markers[0].setMap).toHaveBeenLastCalledWith(null);expect(windows[1].open).toHaveBeenCalledWith(map, markers[1]);
  view.unmount();expect(removeListener).toHaveBeenCalledTimes(2);expect(windows[1].close).toHaveBeenCalled();
});
