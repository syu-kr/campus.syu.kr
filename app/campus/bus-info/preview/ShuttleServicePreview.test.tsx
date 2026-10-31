import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useQuery } from "@tanstack/react-query";
import type { BusLocation } from "@/types";
import type { LiveDataResponse } from "@/types/live-data";
import ShuttleServicePreview from "./ShuttleServicePreview";
import { testServiceData } from "./service-test-data";
const positions=vi.hoisted(()=>({data:undefined as LiveDataResponse<BusLocation[]>|undefined,isError:false,isPending:false,isFetching:false,refetch:vi.fn()}));
const predictions=vi.hoisted(()=>({data:{status:"active",arrivals:[] as {visitId:string;arrivalAt:number;measuredAt:number;validUntil:number}[]},isError:false,isPending:false}));
vi.mock("@tanstack/react-query",()=>({useQuery:vi.fn((options:{queryKey:string[]})=>options.queryKey[0]==="shuttle-stop-arrivals"?predictions:positions)}));
vi.mock("./ShuttlePreviewMap",()=>({default:({received}:{received:{locations:BusLocation[];stale:boolean}})=><div data-testid="received-map" data-positions={JSON.stringify(received.locations)} data-stale={received.stale} />}));
beforeEach(()=>{
  predictions.data.arrivals=[];
  Object.assign(positions,{data:{success:true,data:[],timestamp:testServiceData.nowISO,source:"shuttle",sourceStatus:"fresh",stale:false},isError:false,isPending:false,isFetching:false});
  vi.spyOn(globalThis,"setInterval").mockReturnValue(0 as unknown as ReturnType<typeof setInterval>);
});
function demo() {render(<ShuttleServicePreview data={{...testServiceData,nowISO:"2026-10-30T11:50:00+09:00"}} operatingPreview />);}
function open(name:string) {const element=screen.getByText(name,{exact:true}).closest("details")!;element.open=true;fireEvent(element,new Event("toggle"));}
function seokgye() {fireEvent.click(screen.getByRole("button",{name:"석계역 순환"}));}
function eta(id="seokgye-4") {return screen.getByTestId(`stop-eta-${id}`);}
it("uses a verified ETA at its matching real visit only",()=>{
  const nowISO="2026-10-30T14:00:00+09:00",measuredAt=Date.parse(nowISO);
  predictions.data.arrivals=[{visitId:"seokgye-taereung-7",arrivalAt:measuredAt+240000,measuredAt,validUntil:measuredAt+90000}];
  render(<ShuttleServicePreview data={{...testServiceData,nowISO}} />);
  expect(eta("seokgye-taereung-7")).toHaveTextContent("약 4분");
  expect(eta("seokgye-taereung-6")).not.toHaveTextContent("약 4분");
});
it("shows the map and every visit without boarding selection, including closed days",()=>{
  render(<ShuttleServicePreview data={testServiceData} />);
  expect(screen.getByTestId("received-map")).toBeVisible();
  expect(screen.queryByLabelText("타는 정류장")).not.toBeInTheDocument();
  expect(screen.getByRole("button",{name:"화랑대역 학교행"})).toHaveAttribute("aria-pressed","true");
  expect(eta("hwarangdae-5-campus")).toHaveTextContent("오늘 운휴");
  open("전체 시간표 보기");
  expect(screen.getAllByRole("link",{name:"학교 스쿨버스 안내"})).toHaveLength(1);
  fireEvent.click(screen.getByRole("button",{name:"학기중"}));
  fireEvent.click(screen.getByRole("button",{name:"금요일"}));
  expect(screen.getByRole("list",{name:"학기중"})).toHaveTextContent("08:15");
});
it("shows predicted arrivals, boarding rules, directions and a moving vehicle on the vertical track",()=>{
  demo();seokgye();
  expect(eta()).toHaveTextContent("약 6분");expect(eta("seokgye-taereung-7")).toHaveTextContent("약 9분");
  const list=screen.getByRole("region",{name:"전체 정류장 도착예상"});
  expect(within(list).getAllByRole("listitem")).toHaveLength(6);
  expect(within(list).getByRole("button",{name:/태릉입구역 \(6번 출구\).*하차.*석계역 방면/})).toBeVisible();
  expect(within(list).getByRole("button",{name:/태릉입구역 \(7번 출구\).*승차.*삼육대학교 방면/})).toBeVisible();
  const bus=document.querySelector('[data-timeline-vehicle="demo-seokgye-0"]')!;
  const progress=Number(bus.getAttribute("data-progress"));
  open("예시 운행 조작");fireEvent.click(screen.getByRole("button",{name:"+30초 이동"}));
  expect(Number(bus.getAttribute("data-progress"))).toBeGreaterThan(progress);
  fireEvent.click(screen.getByRole("button",{name:"+5분 이동"}));
  expect(screen.getByText(/다음 정류장.*석계역 \(4번 출구\).*석계역 방면/)).toBeVisible();
  fireEvent.click(screen.getByRole("button",{name:"별내역 순환"}));
  expect(screen.getByRole("button",{name:/별내역 \(2번 출구\).*승·하차/})).toBeVisible();
});
it("pauses at the selected stop then offers the next vehicle, or passed when no following vehicle exists",()=>{
  demo();seokgye();fireEvent.click(screen.getByRole("button",{name:/석계역 \(4번 출구\).*승·하차/}));open("예시 운행 조작");
  fireEvent.click(screen.getByRole("button",{name:"선택 정류장 도착"}));expect(eta()).toHaveTextContent("도착");
  expect(document.querySelector('[data-timeline-vehicle="demo-seokgye-0"]')).toHaveAttribute("data-progress","3");
  fireEvent.click(screen.getByRole("button",{name:"선택 정류장 통과"}));expect(eta()).toHaveTextContent("약 12분");expect(eta()).toHaveTextContent("다음 버스");
  fireEvent.click(screen.getByRole("checkbox",{name:"후속 차량 있음"}));expect(eta()).toHaveTextContent("통과");
});
it("freezes both map and timeline during delay and restores predictions afterwards",()=>{
  demo();seokgye();open("예시 운행 조작");
  fireEvent.click(screen.getByRole("button",{name:"5배 재생"}));
  fireEvent.click(screen.getByRole("checkbox",{name:"위치 지연"}));
  expect(screen.getByRole("button",{name:"5배 재생"})).toBeDisabled();
  const received=screen.getByTestId("received-map").getAttribute("data-positions"),bus=document.querySelector('[data-timeline-vehicle="demo-seokgye-0"]')!,progress=bus.getAttribute("data-progress");
  fireEvent.click(screen.getByRole("button",{name:"+5분 이동"}));expect(eta()).toHaveTextContent("도착정보 확인 중");
  expect(screen.getByTestId("received-map")).toHaveAttribute("data-positions",received);expect(bus).toHaveAttribute("data-progress",progress);
  fireEvent.click(screen.getByRole("checkbox",{name:"위치 지연"}));expect(eta()).toHaveTextContent("약 1분");
  expect(screen.getByRole("button",{name:"5배 재생"})).toBeEnabled();
});
it("keeps real cached vehicles out of sample mode and does not jump routes at noon",()=>{
  positions.data!.data=[{id:"actual",name:"actual",lat:"37.62",lon:"127.08",status:1,routeid:1}];demo();
  expect(screen.getByTestId("received-map").getAttribute("data-positions")).not.toContain("actual");
  expect(useQuery).toHaveBeenLastCalledWith(expect.objectContaining({enabled:false,refetchInterval:false}));
  open("예시 운행 조작");for(let i=0;i<3;i++) fireEvent.click(screen.getByRole("button",{name:"+5분 이동"}));
  expect(screen.getByRole("button",{name:"화랑대역 학교행"})).toHaveAttribute("aria-pressed","true");
});
it("keeps confirmed boarding rules visible when vehicle locations fail and ETA is unavailable",()=>{
  const nowISO="2026-10-30T14:00:00+09:00";
  positions.isError=true;positions.data!.timestamp=nowISO;positions.data!.data=[{id:"actual",name:"actual",lat:"37.62",lon:"127.08",status:1,routeid:2}];render(<ShuttleServicePreview data={{...testServiceData,nowISO}} />);seokgye();
  expect(screen.getByText(/위치 자료를 불러오지 못했습니다/)).toBeVisible();expect(screen.getByTestId("received-map")).toHaveAttribute("data-stale","true");
  expect(eta()).toHaveTextContent("예측 미제공");
  expect(screen.getByRole("button",{name:/석계역 \(4번 출구\).*승·하차/})).toBeVisible();
  expect(document.querySelectorAll("[data-timeline-vehicle]")).toHaveLength(0);expect(screen.queryByText("운행 중")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"다시 조회"}));expect(positions.refetch).toHaveBeenCalled();
});
it("offers all three tables, preserves current labels and arrivals, and explains unchanged or missing profiles",()=>{
  demo();seokgye();open("전체 시간표 보기");
  const current=screen.getByRole("button",{name:"온라인수업 권장 주간 현재"});expect(current).toHaveAttribute("aria-pressed","true");
  expect(screen.getByRole("list",{name:"온라인수업 권장 주간"})).toHaveTextContent("15:30");
  fireEvent.click(screen.getByRole("button",{name:"월~목"}));expect(screen.getByRole("list",{name:"온라인수업 권장 주간"})).toHaveTextContent("17:30");
  fireEvent.click(screen.getByRole("button",{name:"방학"}));
  const station=screen.getByRole("list",{name:"화랑대역 5번 출구 출발"}), campus=screen.getByRole("list",{name:"학교 출발"});
  expect(station.lastElementChild).toHaveTextContent("16:30");expect(campus.lastElementChild).toHaveTextContent("17:10");
  expect(current).toHaveTextContent("현재");expect(eta()).toHaveTextContent("약 6분");
  fireEvent.click(screen.getByRole("button",{name:"금요일"}));
  expect(station.lastElementChild).toHaveTextContent("14:30");expect(campus.lastElementChild).toHaveTextContent("14:10");expect(campus).not.toHaveTextContent("17:10");
  expect(screen.getByRole("region",{name:"곧 출발하는 버스"})).toHaveTextContent("12:00");
  fireEvent.click(screen.getByRole("button",{name:"별내역 순환"}));fireEvent.click(screen.getByRole("button",{name:"온라인수업 권장 주간"}));
  expect(screen.getByText(/학기중 시간표와 동일/)).toBeVisible();expect(screen.getByRole("button",{name:"학기중 현재"})).toHaveTextContent("현재");
});
it("opens Seokgye after noon and distinguishes stale empty results from fresh zero vehicles",()=>{
  positions.data!.stale=true;render(<ShuttleServicePreview data={{...testServiceData,nowISO:"2026-10-31T12:00:00+09:00"}} />);
  expect(screen.getByRole("button",{name:"석계역 순환"})).toHaveAttribute("aria-pressed","true");expect(screen.queryByText(/현재 수신된 차량이 없습니다/)).not.toBeInTheDocument();
});
it("summarizes only the selected route's vehicles in one line",()=>{
  const nowISO="2026-10-30T14:00:00+09:00";positions.data!.timestamp=nowISO;
  positions.data!.data=[1,2,3].map((id)=>({id:String(id),name:"internal-"+id,lat:"37.62",lon:"127.08",routeid:id===3?1:2,status:1}));
  render(<ShuttleServicePreview data={{...testServiceData,nowISO}} />);seokgye();
  expect(screen.getByText(/지도에 표시된 차량 2대/)).toBeVisible();
  expect(screen.queryByText(/internal-/)).not.toBeInTheDocument();
});
it("disables receiver polling and hides cached vehicles on a KST weekend",()=>{
  positions.data!.data=[{id:"last",name:"last",routeid:1,status:1,lat:"37.62",lon:"127.08"}];
  render(<ShuttleServicePreview data={testServiceData}/>);
  expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({queryKey:["shuttle-preview-locations"],enabled:false,refetchInterval:false}));
  expect(screen.getByTestId("received-map")).toHaveAttribute("data-positions","[]");
});
