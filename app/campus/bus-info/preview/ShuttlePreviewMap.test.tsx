import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { mockKakaoMaps } from "@/tests/kakao-maps-mock";
import ShuttlePreviewMap from "./ShuttlePreviewMap";
import { journeyStops, previewRoutes } from "./preview-data";
import { serviceRoutes } from "./service-data";
import { serviceRoadPaths } from "./service-visits";

const loader = vi.hoisted(() => ({ ready: true }));
vi.mock("@/lib/kakao-maps-loader", () => ({ loadKakaoMapsSdk: async () => loader.ready }));
afterEach(() => { delete window.kakao; vi.unstubAllGlobals(); loader.ready = true; });
const route = previewRoutes.find(item => item.id === "seokgye")!;
const labels = ["학교 출발", "화랑대 2번", "태릉 6번", "석계", "태릉 7번", "학교 도착"];
const indices = journeyStops(route, "campus");

it("server-renders each fallback vehicle title as a single complete string",()=>{
  const error=vi.spyOn(console,"error").mockImplementation(()=>{});
  const html=renderToString(<ShuttlePreviewMap route={serviceRoutes[0]} elapsed={0} selected={0} mode="normal" labels={["화랑대","학교"]} locale="ko" demonstration received={{locations:[{id:"demo",name:"demo",lat:"37.62",lon:"127.08",status:1,routeid:1}],stale:false}} />);
  expect(html).toContain("<title>화랑대역 · 예시 셔틀</title>");
  expect(error).not.toHaveBeenCalled();
});

it("keeps direction-specific markers stable while the vehicle moves and cleans up listeners", async () => {
  const sdk = mockKakaoMaps();
  const OriginalMap = window.kakao!.maps.Map;
  window.kakao!.maps.Map = class {
    constructor(container: HTMLElement, options: ConstructorParameters<typeof OriginalMap>[1]) {
      container.appendChild(document.createElement("canvas"));
      return new OriginalMap(container, options);
    }
  } as unknown as typeof OriginalMap;
  const OriginalMarker = window.kakao!.maps.Marker;
  window.kakao!.maps.Marker = class {
    constructor(options: ConstructorParameters<typeof OriginalMarker>[0]) {
      return Object.assign(new OriginalMarker(options), { setPosition: vi.fn(), setImage: vi.fn(), setZIndex: vi.fn() });
    }
  } as unknown as typeof OriginalMarker;
  Object.assign(window.kakao!.maps, { Polyline: class { setMap = vi.fn(); } });
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  const onSelect = vi.fn();
  const props = { route, selected: 3, mode: "normal" as const, labels, indices, locale: "ko" as const, onSelect };
  const { rerender, unmount } = render(<ShuttlePreviewMap {...props} elapsed={120} />);
  await waitFor(() => expect(sdk.markers).toHaveLength(4));
  expect(sdk.event.addListener).toHaveBeenCalledTimes(2);
  const fitCount = sdk.map.setBounds.mock.calls.length;
  rerender(<ShuttlePreviewMap {...props} elapsed={150} />);
  expect(sdk.markers).toHaveLength(4);
  expect(sdk.map.setBounds).toHaveBeenCalledTimes(fitCount);
  rerender(<ShuttlePreviewMap {...props} indices={journeyStops(route, "station")} selected={1} elapsed={150} />);
  expect(screen.getByRole("region", { name: "선택한 노선 지도" }).querySelectorAll("canvas")).toHaveLength(1);
  unmount();
  expect(sdk.event.removeListener.mock.calls).toEqual(sdk.event.addListener.mock.calls);
});

it("shows the same directional stops in its fallback when the map SDK is unavailable", async () => {
  loader.ready = false;
  render(<ShuttlePreviewMap route={route} elapsed={120} selected={3} mode="normal" labels={labels} indices={indices} locale="ko" />);
  expect(await screen.findByText("지도를 연결하지 못해 노선도로 표시합니다.")).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "선택한 노선 지도" })).toHaveTextContent("태릉 7번");
  expect(screen.queryByText("태릉 6번")).not.toBeInTheDocument();
});

it("keeps one route-colored pin per internal vehicle when trips change or records are reordered", async () => {
  loader.ready = false;
  const runs: import("./preview-data").PreviewRun[] = [
    {runId:"trip-one",vehicleId:"preview-bus-j",departure:0},
    {runId:"trip-two",vehicleId:"preview-bus-j",departure:1800},
  ];
  const props = {route,selected:3,mode:"normal" as const,labels,indices,locale:"ko" as const};
  const {container,rerender} = render(<ShuttlePreviewMap {...props} runs={runs} elapsed={120} />);
  await screen.findByText("지도를 연결하지 못해 노선도로 표시합니다.");
  const image = () => container.querySelector('[data-vehicle-id="preview-bus-j"] image')!;
  const original = image().getAttribute("href");
  expect(decodeURIComponent(original!)).toContain(`fill="${route.color}"`);
  expect(decodeURIComponent(original!)).not.toContain("<text");
  rerender(<ShuttlePreviewMap {...props} runs={[...runs].reverse()} elapsed={1920} />);
  expect(image().getAttribute("href")).toBe(original);
  expect(container.querySelectorAll('[data-vehicle-id="preview-bus-j"]')).toHaveLength(1);
});

it("shows supplied sketch lines and received positions without simulated actual vehicles",async()=>{
  loader.ready=false;
  const props={route:serviceRoutes[0],selected:0,elapsed:0,mode:"ended" as const,labels:["화랑대 5번","학교"],locale:"ko" as const};
  const {container,rerender}=render(<ShuttlePreviewMap {...props} received={{locations:[],stale:false}} />);
  await screen.findByText("배경 지도를 불러올 수 없어 간이 노선도를 표시합니다.");
  expect(container.querySelectorAll("polyline")).toHaveLength(1);
  expect(container.querySelectorAll("[data-stop-pin]")).toHaveLength(2);
  rerender(<ShuttlePreviewMap {...props} received={{locations:[{id:"received-test",name:"test",lat:"37.62",lon:"127.08",status:1,routeid:1}],stale:false}} />);
  expect(container.querySelectorAll("[data-received-vehicle]")).toHaveLength(1);
  expect(container.querySelectorAll("[data-vehicle-id]")).toHaveLength(0);
});

it("updates a received GPS marker without resetting the map or inferring motion",async()=>{
  const sdk=mockKakaoMaps();
  const OriginalMarker=window.kakao!.maps.Marker;
  window.kakao!.maps.Marker=class {
    constructor(options:ConstructorParameters<typeof OriginalMarker>[0]) {
      return Object.assign(new OriginalMarker(options),{setPosition:vi.fn(),setImage:vi.fn(),setZIndex:vi.fn()});
    }
  } as unknown as typeof OriginalMarker;
  vi.stubGlobal("ResizeObserver",class {observe(){} disconnect(){}});
  const props={route:serviceRoutes[0],selected:0,elapsed:0,mode:"normal" as const,labels:["화랑대","학교"],locale:"ko" as const};
  const bus={id:"received-test",name:"test",lat:"37.62",lon:"127.08",status:1 as const,routeid:1 as const};
  const {rerender,unmount}=render(<ShuttlePreviewMap {...props} received={{locations:[bus],stale:false}} />);
  await waitFor(()=>expect(sdk.markers).toHaveLength(3));
  const fitCount=sdk.map.setBounds.mock.calls.length;
  rerender(<ShuttlePreviewMap {...props} received={{locations:[{...bus,lat:"37.621"}],stale:true}} />);
  expect(sdk.markers).toHaveLength(3);
  expect(sdk.map.setBounds).toHaveBeenCalledTimes(fitCount);
  rerender(<ShuttlePreviewMap {...props} selected={1} received={{locations:[bus,{...bus,id:"another"}],stale:false}} />);
  expect(sdk.map.setBounds).toHaveBeenCalledTimes(fitCount);
  unmount();
  expect(sdk.markers.every(marker=>vi.mocked(marker.setMap).mock.calls.some(call=>call[0]===null))).toBe(true);
});
it("merges co-located campus visits on the map and keeps the final boarding exit selectable",async()=>{
  const sdk=mockKakaoMaps(),onSelect=vi.fn();
  const OriginalMarker=window.kakao!.maps.Marker;
  window.kakao!.maps.Marker=class {
    constructor(options:ConstructorParameters<typeof OriginalMarker>[0]) {
      return Object.assign(new OriginalMarker(options),{setPosition:vi.fn(),setImage:vi.fn(),setZIndex:vi.fn()});
    }
  } as unknown as typeof OriginalMarker;
  vi.stubGlobal("ResizeObserver",class {observe(){} disconnect(){}});
  render(<ShuttlePreviewMap route={serviceRoutes[1]} elapsed={0} selected={3} mode="normal" labels={["학교 출발","화랑대2","태릉6","석계4","태릉7","학교 도착"]} locale="ko" onSelect={onSelect} received={{locations:[],stale:false}} />);
  await waitFor(()=>expect(sdk.markers).toHaveLength(5));
  expect(sdk.event.addListener).toHaveBeenCalledTimes(5);
  const handler=sdk.event.addListener.mock.calls.at(-1)![2] as ()=>void;
  handler();expect(onSelect).toHaveBeenCalledWith(4);
});

it("keeps full geographic road vertices through zoom, resize and vehicle updates",async()=>{
  const sdk=mockKakaoMaps(),geometries:unknown[]=[];
  const OriginalMarker=window.kakao!.maps.Marker;
  window.kakao!.maps.Marker=class {constructor(options:ConstructorParameters<typeof OriginalMarker>[0]) {return Object.assign(new OriginalMarker(options),{setPosition:vi.fn(),setImage:vi.fn(),setZIndex:vi.fn()});}} as unknown as typeof OriginalMarker;
  Object.assign(window.kakao!.maps,{Polyline:class {constructor(options:{path:unknown}) {geometries.push(options.path);}setMap(){}}});
  const center={lat:37.63,lng:127.1};Object.assign(sdk.map,{getCenter:()=>center});
  let resize=()=>{};vi.stubGlobal("ResizeObserver",class {constructor(callback:()=>void){resize=callback;}observe(){}disconnect(){}});
  const props={route:serviceRoutes[0],selected:0,elapsed:0,mode:"normal" as const,labels:["화랑대5","학교"],locale:"ko" as const};
  const {rerender}=render(<ShuttlePreviewMap {...props} received={{locations:[],stale:false}} />);
  await waitFor(()=>expect(geometries).toHaveLength(1));
  const before=JSON.stringify(geometries);
  expect(geometries[0]).toEqual(serviceRoadPaths(props.route)[0].map(([lat,lng])=>({lat,lng})));
  const container=screen.getByRole("region",{name:"선택한 노선 지도"});
  let width=900;Object.defineProperty(container,"clientWidth",{get:()=>width});resize();
  const fits=sdk.map.setBounds.mock.calls.length;
  width=390;resize();expect(sdk.map.setBounds).toHaveBeenCalledTimes(fits+1);
  fireEvent.wheel(container);
  width=320;resize();expect(sdk.map.setCenter).toHaveBeenCalledWith(center);expect(sdk.map.setBounds).toHaveBeenCalledTimes(fits+1);
  resize();rerender(<ShuttlePreviewMap {...props} received={{locations:[],stale:true}} />);
  expect(JSON.stringify(geometries)).toBe(before);expect(geometries).toHaveLength(1);
});
