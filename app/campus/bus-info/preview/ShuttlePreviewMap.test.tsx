import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { mockKakaoMaps } from "@/tests/kakao-maps-mock";
import type { BusLocation } from "@/types";
import ShuttlePreviewMap from "./ShuttlePreviewMap";
import { serviceRoutes } from "./service-data";
import { serviceRoadPaths } from "./service-visits";
import { demoLocations } from "./service-demo";
import { testServiceData } from "./service-test-data";

const m=vi.hoisted(()=>({ready:true,eta:vi.fn(),minutes:new Map<string,number>(),observations:new Map<string,{arrivalAt:number}>()}));
vi.mock("@/lib/kakao-maps-loader",()=>({loadKakaoMapsSdk:async()=>m.ready}));
vi.mock("./use-stop-arrivals",()=>({useStopArrivals:(...args:unknown[])=>{m.eta(...args);return {minutes:m.minutes,observations:m.observations,status:"learning"};}}));
beforeEach(()=>{m.ready=true;m.minutes.clear();m.observations.clear();m.eta.mockClear();vi.stubGlobal("ResizeObserver",class {observe(){}disconnect(){}});});
afterEach(()=>{delete window.kakao;vi.unstubAllGlobals();});
const buses:BusLocation[]=[
  {id:"bus-A",name:"not-shown-A",lat:"37.62",lon:"127.08",routeid:1,status:2},
  {id:"bus-B",name:"not-shown-B",lat:"37.63",lon:"127.09",routeid:2,status:1},
  {id:"bus-C",name:"not-shown-C",lat:"37.64",lon:"127.11",routeid:3,status:1},
];
const now=new Date("2026-11-02T12:00:00+09:00");
const props={received:{locations:buses,stale:false},now,locale:"ko" as const,onClose:vi.fn()};
const picker=()=>screen.getByRole("group",{name:"지도 차량 선택"});
const choose=(name:RegExp)=>fireEvent.click(within(picker()).getByRole("button",{name}));
function prepareSdk() {
  const sdk=mockKakaoMaps(),geometries:{path:unknown;setMap:ReturnType<typeof vi.fn>}[]=[];
  const OriginalMarker=window.kakao!.maps.Marker,OriginalMap=window.kakao!.maps.Map;
  window.kakao!.maps.Marker=class {constructor(options:ConstructorParameters<typeof OriginalMarker>[0]){return Object.assign(new OriginalMarker(options),{setPosition:vi.fn(),setImage:vi.fn(),setZIndex:vi.fn(),setTitle:vi.fn()});}} as unknown as typeof OriginalMarker;
  window.kakao!.maps.Map=class {constructor(container:HTMLElement,options:ConstructorParameters<typeof OriginalMap>[1]){container.appendChild(document.createElement("canvas"));return new OriginalMap(container,options);}} as unknown as typeof OriginalMap;
  Object.assign(window.kakao!.maps,{Polyline:class {setMap=vi.fn();constructor(options:{path:unknown}){geometries.push({path:options.path,setMap:this.setMap});}}});
  const center={lat:37.63,lng:127.1};Object.assign(sdk.map,{getCenter:()=>center});
  let resize=()=>{};vi.stubGlobal("ResizeObserver",class {constructor(callback:()=>void){resize=callback;}observe(){}disconnect(){}});
  return {...sdk,markers:sdk.markers as (KakaoMarker&{setTitle:ReturnType<typeof vi.fn>})[],geometries,center,resize:()=>resize()};
}

it("initially shows vehicles from every route without drawing an unselected route",async()=>{
  m.ready=false;const {container}=render(<ShuttlePreviewMap {...props}/>);
  await screen.findByText("배경 지도를 불러올 수 없어 간이 노선도를 표시합니다.");
  expect(container.querySelectorAll("[data-received-vehicle]")).toHaveLength(3);
  expect(container.querySelectorAll("polyline,[data-stop-pin]")).toHaveLength(0);
  expect(within(picker()).getAllByRole("button")).toHaveLength(3);
  expect(screen.queryByText(/not-shown-/)).not.toBeInTheDocument();
  expect(m.eta).toHaveBeenLastCalledWith(now,false,undefined,true,"/campus/bus-info/preview/eta");
});
it("selects a vehicle's complete route and scopes predictions to that vehicle",async()=>{
  m.ready=false;m.minutes.set("seokgye-4",7);
  const {container,rerender}=render(<ShuttlePreviewMap {...props}/>);
  choose(/석계역/);
  const panel=screen.getByRole("region",{name:"선택 차량 정류장별 도착예상"});
  expect(within(panel).getAllByRole("listitem")).toHaveLength(6);
  expect(within(panel).getByText(/7분 후/)).toBeInTheDocument();
  expect(container.querySelectorAll("polyline")).toHaveLength(5);
  expect(container.querySelectorAll("[data-stop-pin]")).toHaveLength(5);
  expect(container.querySelectorAll("[data-received-vehicle]")).toHaveLength(3);
  expect(m.eta).toHaveBeenLastCalledWith(now,true,"bus-B",true,"/campus/bus-info/preview/eta");
  fireEvent.click(within(panel).getByRole("button",{name:/석계역 4번 출구/}));
  expect(screen.getByRole("status")).toHaveTextContent("석계역 4번 출구 · 7분 후");
  rerender(<ShuttlePreviewMap {...props} received={{locations:buses,stale:true}}/>);
  expect(within(panel).queryByText(/7분 후/)).not.toBeInTheDocument();
  expect(m.eta).toHaveBeenLastCalledWith(now,false,"bus-B",true,"/campus/bus-info/preview/eta");
  rerender(<ShuttlePreviewMap {...props} received={{locations:[buses[0],buses[2]],stale:false}}/>);
  expect(screen.queryByRole("region",{name:"선택 차량 정류장별 도착예상"})).not.toBeInTheDocument();
  expect(screen.getByText("선택한 차량의 위치를 다시 확인해 주세요.")).toBeInTheDocument();
  expect(container.querySelectorAll("polyline,[data-stop-pin]")).toHaveLength(0);
});
it.each([
  {locale:"ko" as const,group:"지도 차량 선택",vehicle:/석계역/,region:"선택 차량 정류장별 도착예상",stop:/석계역 4번 출구/,missing:/태릉입구역 7번 출구/,eta:"7분 후 · 12:07"},
  {locale:"en" as const,group:"Select a map vehicle",vehicle:/Seokgye/,region:"Selected vehicle arrivals",stop:/Seokgye Exit 4/,missing:/Taereung Exit 7/,eta:"in 7 min · 12:07"},
])("shows the countdown and exact arrival clock, with a dash for missing predictions: $locale",({locale,group,vehicle,region,stop,missing,eta})=>{
  m.ready=false;m.minutes.set("seokgye-4",7);m.observations.set("seokgye-4",{arrivalAt:now.getTime()+7*60000});
  render(<ShuttlePreviewMap {...props} locale={locale}/>);
  fireEvent.click(within(screen.getByRole("group",{name:group})).getByRole("button",{name:vehicle}));
  const panel=screen.getByRole("region",{name:region});
  expect(within(panel).getByRole("button",{name:stop})).toHaveTextContent(eta);
  expect(within(panel).getByRole("button",{name:missing})).toHaveTextContent("—");
  expect(panel).not.toHaveTextContent(/예측 안내|최근 위치 반영|보정 중|최신 위치를 확인/);
});
it("supports fallback marker keyboard selection and the Hwarangdae return movement",async()=>{
  m.ready=false;const bus={...buses[0],status:1 as const};
  const {container}=render(<ShuttlePreviewMap {...props} received={{locations:[bus],stale:false}}/>);
  const marker=container.querySelector("[data-received-vehicle]")!;
  fireEvent.keyDown(marker,{key:"Enter"});
  expect(screen.getByRole("region",{name:"선택 차량 정류장별 도착예상"})).toHaveTextContent("복귀 이동");
  expect(container.querySelector('[data-stop-pin="hwarangdae-return-station"]')).not.toBeNull();
  expect(container.querySelector('[data-stop-pin="hwarangdae-campus-arrival"]')).toBeNull();
  expect(container.querySelectorAll("polyline").length).toBeGreaterThan(0);
});
it("uses the selected sample vehicle instead of the next bus's ETA",()=>{
  m.ready=false;const departures=[0,600],sample=demoLocations(serviceRoutes[1],700,true,departures);
  render(<ShuttlePreviewMap {...props} received={{locations:sample,stale:false}} demo={{elapsed:700,nextAvailable:true,delayed:false,departuresByRoute:{seokgye:departures}}}/>);
  expect(screen.getByRole("dialog",{name:"전체 셔틀 지도 · 예시 운행"})).toBeVisible();
  choose(/차량 1/);
  let panel=screen.getByRole("region",{name:"선택 차량 정류장별 도착예상"});
  expect(within(panel).getByRole("button",{name:/석계역 4번 출구/})).toHaveTextContent("통과");
  choose(/차량 2/);panel=screen.getByRole("region",{name:"선택 차량 정류장별 도착예상"});
  expect(within(panel).getByRole("button",{name:/석계역 4번 출구/})).toHaveTextContent("10분 후");
  expect(m.eta).toHaveBeenLastCalledWith(now,false,sample[1].id,true,"/campus/bus-info/preview/eta");
});
it("labels only the final sample's confirmed terminal arrival as the last bus arrival",()=>{
  m.ready=false;
  const departures=[0,1800],sample=demoLocations(serviceRoutes[1],1260,false,departures);
  const {rerender}=render(<ShuttlePreviewMap {...props} received={{locations:sample,stale:false}} demo={{elapsed:1260,nextAvailable:false,delayed:false,departuresByRoute:{seokgye:departures}}}/>);
  choose(/석계역/);
  const panel=screen.getByRole("region",{name:"선택 차량 정류장별 도착예상"});
  expect(within(panel).getByRole("button",{name:/학교 도착/})).toHaveTextContent("막차 도착");
  rerender(<ShuttlePreviewMap {...props} received={{locations:sample,stale:false}} demo={{elapsed:1260,nextAvailable:true,delayed:false,departuresByRoute:{seokgye:departures}}}/>);
  expect(within(panel).getByRole("button",{name:/학교 도착/})).toHaveTextContent("도착");
  expect(within(panel).getByRole("button",{name:/학교 도착/})).not.toHaveTextContent("막차");
});
it("describes elapsed origin schedules without claiming an observed last departure",()=>{
  m.ready=false;
  const after=new Date("2026-11-02T20:00:00+09:00"),data={...testServiceData,nowISO:after.toISOString(),holidays:{...testServiceData.holidays,lastSuccessAt:after.toISOString()}};
  render(<ShuttlePreviewMap {...props} now={after} data={data}/>);
  choose(/석계역/);
  const panel=screen.getByRole("region",{name:"선택 차량 정류장별 도착예상"});
  expect(within(panel).getByRole("button",{name:/학교 출발/})).toHaveTextContent("막차 출발");
});
it("keeps GPS markers stable, draws complete geographic vertices after a marker click, and cleans up",async()=>{
  const sdk=prepareSdk();const {rerender,unmount}=render(<ShuttlePreviewMap {...props}/>);
  await waitFor(()=>expect(sdk.markers).toHaveLength(3));
  expect(sdk.geometries).toHaveLength(0);
  act(()=>sdk.event.addListener.mock.calls[1][2]());
  await waitFor(()=>expect(sdk.geometries).toHaveLength(5));
  expect(sdk.geometries[0].path).toEqual(serviceRoadPaths(serviceRoutes[1])[0].map(([lat,lng])=>({lat,lng})));
  const fits=sdk.map.setBounds.mock.calls.length,markers=sdk.markers.length;
  rerender(<ShuttlePreviewMap {...props} received={{locations:[...buses].reverse().map(bus=>({...bus,lat:String(Number(bus.lat)+.001)})),stale:false}}/>);
  expect(sdk.markers).toHaveLength(markers);expect(sdk.map.setBounds).toHaveBeenCalledTimes(fits);
  expect(sdk.markers[0].setTitle).toHaveBeenLastCalledWith("화랑대역 · 차량 3 · 학교 방면");
  expect(sdk.geometries).toHaveLength(5);
  expect(screen.getByRole("region",{name:"전체 셔틀 지도"}).querySelectorAll("canvas")).toHaveLength(1);
  choose(/별내역/);
  expect(sdk.geometries.slice(0,5).every(line=>line.setMap.mock.calls.some(call=>call[0]===null))).toBe(true);
  unmount();expect(sdk.event.removeListener).toHaveBeenCalledTimes(sdk.event.addListener.mock.calls.length);
  for(const args of sdk.event.addListener.mock.calls)expect(sdk.event.removeListener).toHaveBeenCalledWith(...args);
  expect(sdk.markers.every(marker=>vi.mocked(marker.setMap).mock.calls.some(call=>call[0]===null))).toBe(true);
});
it("retains the user's map center during resize and offers a fleet overview reset",async()=>{
  const sdk=prepareSdk();render(<ShuttlePreviewMap {...props}/>);
  await waitFor(()=>expect(sdk.markers).toHaveLength(3));
  const region=screen.getByRole("region",{name:"전체 셔틀 지도"});
  let width=900;Object.defineProperty(document.querySelector(".shuttle-fleet-canvas")!,"clientWidth",{get:()=>width});sdk.resize();
  fireEvent.wheel(region);const fits=sdk.map.setBounds.mock.calls.length;
  width=320;sdk.resize();expect(sdk.map.setCenter).toHaveBeenCalledWith(sdk.center);expect(sdk.map.setBounds).toHaveBeenCalledTimes(fits);
  fireEvent.click(screen.getByRole("button",{name:"전체 차량 보기"}));expect(sdk.map.setBounds).toHaveBeenCalledTimes(fits+1);
  fireEvent.keyDown(document,{key:"Escape"});expect(props.onClose).toHaveBeenCalled();
});
