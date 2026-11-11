import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { useQuery } from "@tanstack/react-query";
import type { BusLocation } from "@/types";
import type { LiveDataResponse } from "@/types/live-data";
import type { EtaResponse } from "@/lib/shuttle-eta";
import ShuttleServicePreview from "./ShuttleServicePreview";
import { testServiceData } from "./service-test-data";
import { pointAlongPath,serviceRoadPaths,serviceVisits } from "./service-visits";
const positions=vi.hoisted(()=>({data:undefined as LiveDataResponse<BusLocation[]>|undefined,isError:false,isPending:false,isFetching:false,refetch:vi.fn()}));
const predictions=vi.hoisted(()=>({data:{status:"active",arrivals:[]} as EtaResponse,isError:false,isPending:false}));
const navigation=vi.hoisted(()=>({refresh:vi.fn()}));
const refresh=navigation.refresh;
vi.mock("next/navigation",()=>({useRouter:()=>navigation}));
vi.mock("@tanstack/react-query",()=>({useQuery:vi.fn((options:{queryKey:string[]})=>options.queryKey[0]==="shuttle-stop-arrivals"?predictions:positions)}));
vi.mock("./ShuttlePreviewMap",()=>({default:({received,onClose}:{received:{locations:BusLocation[];stale:boolean};onClose:()=>void})=><div data-testid="received-map" data-positions={JSON.stringify(received.locations)} data-stale={received.stale}><button onClick={onClose}>지도 닫기</button></div>}));
beforeEach(()=>{
  predictions.data={status:"active",arrivals:[]};predictions.isError=false;refresh.mockReset();
  Object.assign(positions,{data:{success:true,data:[],timestamp:testServiceData.nowISO,source:"shuttle",sourceStatus:"fresh",stale:false},isError:false,isPending:false,isFetching:false});
  vi.spyOn(globalThis,"setInterval").mockReturnValue(0 as unknown as ReturnType<typeof setInterval>);
});
function demo() {render(<ShuttleServicePreview data={{...testServiceData,nowISO:"2026-10-30T11:50:00+09:00"}} operatingPreview />);}
function open(name:string) {const element=screen.getByText(name,{exact:true}).closest("details")!;element.open=true;fireEvent(element,new Event("toggle"));}
function seokgye() {fireEvent.click(screen.getByRole("button",{name:"석계역 순환"}));}
function eta(id="seokgye-4") {return screen.getByTestId(`stop-eta-${id}`);}
function map() {fireEvent.click(screen.getByRole("button",{name:"셔틀 위치 보기"}));}
it("uses a verified ETA at its matching real visit only",()=>{
  const nowISO="2026-10-30T14:00:00+09:00",measuredAt=Date.parse(nowISO);
  predictions.data.arrivals=[{visitId:"seokgye-taereung-7",arrivalAt:measuredAt+240000,measuredAt,validUntil:measuredAt+90000}];
  positions.data!.timestamp=nowISO;positions.data!.data=[{id:"actual",name:"actual",lat:"37.62",lon:"127.08",status:2,routeid:2}];
  render(<ShuttleServicePreview data={{...testServiceData,nowISO}} />);
  expect(eta("seokgye-taereung-7")).toHaveTextContent("4분 후");
  expect(eta("seokgye-taereung-6")).not.toHaveTextContent("4분 후");
  expect(eta("seokgye-taereung-7")).toHaveTextContent("14:04");
  expect(screen.getByRole("region",{name:"전체 정류장 도착예상"})).not.toHaveTextContent(/최근 위치 반영|운행 예측|예측 안내|예정편|보정 중/);
});
it("keeps a valid observation ETA when the separate position refresh fails",()=>{
  const nowISO="2026-10-30T14:00:00+09:00",measuredAt=Date.parse(nowISO);
  predictions.data.status="learning";predictions.data.arrivals=[{visitId:"seokgye-taereung-7",arrivalAt:measuredAt+240000,measuredAt,validUntil:measuredAt+90000}];
  positions.data!.timestamp=nowISO;positions.data!.data=[{id:"actual",name:"actual",lat:"37.62",lon:"127.08",status:2,routeid:2}];
  const {rerender}=render(<ShuttleServicePreview data={{...testServiceData,nowISO}} />);
  expect(eta("seokgye-taereung-7")).toHaveTextContent("4분 후");
  positions.isError=true;rerender(<ShuttleServicePreview data={{...testServiceData,nowISO}} />);
  expect(eta("seokgye-taereung-7")).toHaveTextContent("4분 후");
  expect(eta("seokgye-taereung-7")).toHaveTextContent("14:04");
  positions.data!.data=[];rerender(<ShuttleServicePreview data={{...testServiceData,nowISO}} />);
  expect(eta("seokgye-taereung-7")).toHaveTextContent("4분 후");
});
it("opens the fleet map only on demand and keeps every visit visible on closed days",()=>{
  render(<ShuttleServicePreview data={testServiceData} />);
  expect(screen.queryByTestId("received-map")).not.toBeInTheDocument();map();
  expect(screen.getByTestId("received-map")).toBeVisible();
  fireEvent.click(screen.getByRole("button",{name:"지도 닫기"}));expect(screen.queryByTestId("received-map")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("타는 정류장")).not.toBeInTheDocument();
  expect(screen.getByRole("button",{name:"화랑대역 학교행"})).toHaveAttribute("aria-pressed","true");
  expect(eta("hwarangdae-5-campus")).toHaveTextContent("오늘 운휴");
  expect(screen.queryByText("전체 시간표 보기")).not.toBeInTheDocument();
  expect(screen.getAllByRole("link",{name:"학교 스쿨버스 안내"})).toHaveLength(1);
  fireEvent.click(screen.getByRole("button",{name:/^학기중/}));
  fireEvent.click(screen.getByRole("button",{name:"금요일"}));
  expect(screen.getByRole("list",{name:"학기중"})).toHaveTextContent("08:15");
});
it("shows predicted arrivals, boarding rules, directions and a moving vehicle on the vertical track",()=>{
  demo();seokgye();
  expect(eta()).toHaveTextContent("21분 후");expect(eta("seokgye-taereung-7")).toHaveTextContent("24분 후");
  expect(eta("seokgye-campus-departure")).toHaveTextContent("12:00 출발 예정");
  expect(document.querySelector('[data-timeline-vehicle="demo-seokgye-0"]')).toBeNull();
  const list=screen.getByRole("region",{name:"전체 정류장 도착예상"});
  expect(within(list).getAllByRole("listitem")).toHaveLength(6);
  expect(within(list).getByRole("button",{name:/태릉입구역 \(6번 출구\).*하차.*석계역 방면/})).toBeVisible();
  expect(within(list).getByRole("button",{name:/태릉입구역 \(7번 출구\).*승차.*삼육대학교 방면/})).toBeVisible();
  open("예시 운행 조작");
  fireEvent.click(screen.getByRole("button",{name:"+5분 이동"}));fireEvent.click(screen.getByRole("button",{name:"+5분 이동"}));
  const bus=document.querySelector('[data-timeline-vehicle="demo-seokgye-0"]')!;
  const progress=Number(bus.getAttribute("data-progress"));
  fireEvent.click(screen.getByRole("button",{name:"+30초 이동"}));
  expect(Number(bus.getAttribute("data-progress"))).toBeGreaterThan(progress);
  fireEvent.click(screen.getByRole("button",{name:"+5분 이동"}));
  expect(screen.getByText(/다음 정류장.*태릉입구역.*석계역 방면/)).toBeVisible();
  fireEvent.click(screen.getByRole("button",{name:"별내역 순환"}));
  expect(screen.getByRole("button",{name:/별내역 \(2번 출구\).*승·하차/})).toBeVisible();
});
it("pauses at the selected stop then offers the next vehicle, or passed when no following vehicle exists",()=>{
  demo();seokgye();fireEvent.click(screen.getByRole("button",{name:/석계역 \(4번 출구\).*승·하차/}));open("예시 운행 조작");
  fireEvent.click(screen.getByRole("button",{name:"선택 정류장 도착"}));expect(eta()).toHaveTextContent("도착");
  expect(document.querySelector('[data-timeline-vehicle="demo-seokgye-0"]')).toHaveAttribute("data-progress","3");
  fireEvent.click(screen.getByRole("button",{name:"선택 정류장 통과"}));expect(eta()).toHaveTextContent("30분 후");expect(eta()).not.toHaveTextContent("다음 버스");
  fireEvent.click(screen.getByRole("checkbox",{name:"후속 차량 있음"}));expect(eta()).toHaveTextContent("막차 도착");
});
it("freezes both map and timeline during delay and restores predictions afterwards",()=>{
  demo();seokgye();open("예시 운행 조작");map();
  for(let index=0;index<3;index++)fireEvent.click(screen.getByRole("button",{name:"+5분 이동"}));
  fireEvent.click(screen.getByRole("button",{name:"5배 재생"}));
  fireEvent.click(screen.getByRole("checkbox",{name:"위치 지연"}));
  expect(screen.getByRole("button",{name:"5배 재생"})).toBeDisabled();
  const received=screen.getByTestId("received-map").getAttribute("data-positions"),bus=document.querySelector('[data-timeline-vehicle="demo-seokgye-0"]')!,progress=bus.getAttribute("data-progress");
  fireEvent.click(screen.getByRole("button",{name:"+5분 이동"}));expect(eta()).toHaveTextContent("—");
  expect(screen.getByTestId("received-map")).toHaveAttribute("data-positions",received);expect(bus).toHaveAttribute("data-progress",progress);
  fireEvent.click(screen.getByRole("checkbox",{name:"위치 지연"}));expect(eta()).toHaveTextContent("1분 후");
  expect(screen.getByRole("button",{name:"5배 재생"})).toBeEnabled();
});
it("keeps real cached vehicles out of sample mode and does not jump routes at noon",()=>{
  positions.data!.data=[{id:"actual",name:"actual",lat:"37.62",lon:"127.08",status:1,routeid:1}];demo();
  map();
  expect(screen.getByTestId("received-map").getAttribute("data-positions")).not.toContain("actual");
  expect(useQuery).toHaveBeenLastCalledWith(expect.objectContaining({enabled:false,refetchInterval:false}));
  open("예시 운행 조작");for(let i=0;i<3;i++) fireEvent.click(screen.getByRole("button",{name:"+5분 이동"}));
  expect(screen.getByRole("button",{name:"화랑대역 학교행"})).toHaveAttribute("aria-pressed","true");
});
it("keeps confirmed boarding rules visible when vehicle locations fail and ETA is unavailable",()=>{
  const nowISO="2026-10-30T14:00:00+09:00";
  positions.isError=true;positions.data!.timestamp=nowISO;positions.data!.data=[{id:"actual",name:"actual",lat:"37.62",lon:"127.08",status:1,routeid:2}];render(<ShuttleServicePreview data={{...testServiceData,nowISO}} />);seokgye();
  map();
  expect(screen.queryByText(/위치 자료를 불러오지 못했습니다/)).not.toBeInTheDocument();expect(screen.getByTestId("received-map")).toHaveAttribute("data-stale","true");
  expect(eta()).toHaveTextContent("—");
  expect(screen.getByRole("button",{name:/석계역 \(4번 출구\).*승·하차/})).toBeVisible();
  expect(document.querySelectorAll("[data-timeline-vehicle]")).toHaveLength(0);expect(screen.getAllByText("운행 중").length).toBeGreaterThan(0);
  expect(screen.queryByRole("button",{name:"다시 조회"})).not.toBeInTheDocument();
});
it("limits vacation to Hwarangdae and special timetables to routes with a registered change",()=>{
  demo();seokgye();
  const current=screen.getByRole("button",{name:"온라인수업 권장 주간 현재"});expect(current).toHaveAttribute("aria-pressed","true");
  expect(screen.getByRole("list",{name:"온라인수업 권장 주간"})).toHaveTextContent("15:30");
  fireEvent.click(screen.getByRole("button",{name:"월~목"}));expect(screen.getByRole("list",{name:"온라인수업 권장 주간"})).toHaveTextContent("17:30");
  expect(screen.queryByRole("button",{name:"방학"})).not.toBeInTheDocument();
  expect(eta()).toHaveTextContent("21분 후");
  fireEvent.click(screen.getByRole("button",{name:"화랑대역 학교행"}));
  fireEvent.click(screen.getByRole("button",{name:"방학"}));
  fireEvent.click(screen.getByRole("button",{name:"월~목"}));
  const station=screen.getByRole("list",{name:"화랑대역 5번 출구 출발"}), campus=screen.getByRole("list",{name:"학교 출발"});
  expect(station.lastElementChild).toHaveTextContent("16:30");expect(campus.lastElementChild).toHaveTextContent("17:10");
  expect(screen.getByRole("button",{name:"온라인수업 권장 주간 현재"})).toHaveTextContent("현재");
  fireEvent.click(screen.getByRole("button",{name:"금요일"}));
  expect(station.lastElementChild).toHaveTextContent("14:30");expect(campus.lastElementChild).toHaveTextContent("14:10");expect(campus).not.toHaveTextContent("17:10");
  expect(screen.queryByRole("region",{name:"곧 출발하는 버스"})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"별내역 순환"}));
  expect(screen.queryByRole("button",{name:/온라인수업 권장 주간/})).not.toBeInTheDocument();
  expect(screen.getByRole("button",{name:"학기중 현재"})).toHaveAttribute("aria-pressed","true");
  expect(screen.queryByRole("button",{name:"방학"})).not.toBeInTheDocument();
});
it("opens Seokgye after noon and distinguishes stale empty results from fresh zero vehicles",()=>{
  positions.data!.stale=true;render(<ShuttleServicePreview data={{...testServiceData,nowISO:"2026-10-31T12:00:00+09:00"}} />);
  expect(screen.getByRole("button",{name:"석계역 순환"})).toHaveAttribute("aria-pressed","true");expect(screen.queryByText(/현재 수신된 차량이 없습니다/)).not.toBeInTheDocument();
});
it("passes every route's vehicles to the map without a separate fleet status row",()=>{
  const nowISO="2026-10-30T14:00:00+09:00";positions.data!.timestamp=nowISO;
  positions.data!.data=[1,2,3].map((id)=>({id:String(id),name:"internal-"+id,lat:"37.62",lon:"127.08",routeid:id===3?1:2,status:1}));
  render(<ShuttleServicePreview data={{...testServiceData,nowISO}} />);seokgye();
  expect(screen.queryByText(/수신 차량 3대|현재 표시할 차량 위치 없음/)).not.toBeInTheDocument();map();
  expect(JSON.parse(screen.getByTestId("received-map").getAttribute("data-positions")!)).toHaveLength(3);
  expect(screen.queryByText(/internal-/)).not.toBeInTheDocument();
});
it("disables receiver polling and hides cached vehicles on a KST weekend",()=>{
  positions.data!.data=[{id:"last",name:"last",routeid:1,status:1,lat:"37.62",lon:"127.08"}];
  render(<ShuttleServicePreview data={testServiceData}/>);
  map();
  expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({queryKey:["shuttle-preview-locations","preview"],enabled:false,refetchInterval:false}));
  expect(screen.getByTestId("received-map")).toHaveAttribute("data-positions","[]");
});
it("stops locations and high-frequency ETA polling after the final collection window while keeping timetable guidance",()=>{
  const nowISO="2026-11-02T20:00:00+09:00";
  positions.data!.timestamp=nowISO;
  positions.data!.data=[{id:"cached",name:"cached",routeid:2,status:1,lat:"37.62",lon:"127.08"}];
  render(<ShuttleServicePreview data={{...testServiceData,nowISO,holidays:{...testServiceData.holidays,lastSuccessAt:nowISO}}}/>);
  expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({queryKey:["shuttle-preview-locations","preview"],enabled:false,refetchInterval:false}));
  expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({queryKey:expect.arrayContaining(["shuttle-stop-arrivals"]),enabled:true,refetchInterval:false}));
  expect(eta("seokgye-campus-departure")).toHaveTextContent("막차 출발");
  map();expect(screen.getByTestId("received-map")).toHaveAttribute("data-positions","[]");
});
it("uses the passenger API surface in a production rehearsal and hides preview tools",()=>{
  const nowISO="2026-11-02T13:20:00+09:00";
  render(<ShuttleServicePreview surface="production" operatingPreview data={{...testServiceData,nowISO,holidays:{...testServiceData.holidays,lastSuccessAt:nowISO}}}/>);
  expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({queryKey:["shuttle-preview-locations","production"]}));
  expect(useQuery).toHaveBeenCalledWith(expect.objectContaining({queryKey:expect.arrayContaining(["/api/bus/shuttle/eta"])}));
  expect(screen.queryByRole("link",{name:"운행 예시 보기"})).not.toBeInTheDocument();
  expect(screen.queryByText("예시 운행 조작")).not.toBeInTheDocument();
  expect(document.querySelectorAll("[data-timeline-vehicle]")).toHaveLength(0);
});
it("uses scheduled service hours for badges without waiting for a vehicle ETA model",()=>{
  const nowISO="2026-11-02T11:00:00+09:00";positions.data!.timestamp=nowISO;
  positions.data!.data=[{id:"actual",name:"actual",routeid:1,status:2,lat:"37.62",lon:"127.08"}];
  predictions.data.status="collecting";
  render(<ShuttleServicePreview data={{...testServiceData,nowISO,holidays:{...testServiceData.holidays,lastSuccessAt:nowISO}}}/>);
  const status=(name:string)=>document.getElementById(screen.getByRole("button",{name}).getAttribute("aria-describedby")!)!;
  expect(status("화랑대역 학교행")).toHaveTextContent("운행 중");
  expect(status("별내역 순환")).toHaveTextContent("운행 중");
  expect(status("석계역 순환")).toHaveTextContent("운행 전");
  expect(screen.queryByText("시간표상 운행")).not.toBeInTheDocument();
});
it("renders timetable and predictions together in preview with the operating example available",()=>{
  const nowISO="2026-11-02T13:20:00+09:00";
  const point=pointAlongPath(serviceRoadPaths({id:"seokgye"})[0],.4);
  positions.data!.timestamp=nowISO;positions.data!.data=[{id:"real-position",name:"internal",routeid:2,status:1,lat:String(point[0]),lon:String(point[1])}];
  const data={...testServiceData,nowISO,holidays:{...testServiceData.holidays,lastSuccessAt:nowISO}};
  const view=render(<ShuttleServicePreview data={data}/>);
  expect(screen.getByRole("link",{name:"운행 예시 보기"})).toBeVisible();
  expect(screen.queryByText("전체 시간표 보기")).not.toBeInTheDocument();
  expect(screen.getByRole("region",{name:"출발 시간표"})).toBeVisible();
  const heading=screen.getByRole("heading",{name:"전체 정류장 도착예상"});
  const arrivals=screen.getByRole("region",{name:"전체 정류장 도착예상"}),timetable=screen.getByRole("region",{name:"출발 시간표"});
  expect(arrivals.compareDocumentPosition(timetable)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(screen.queryByRole("region",{name:"곧 출발하는 버스"})).not.toBeInTheDocument();
  expect(within(heading.parentElement!).getByRole("button",{name:"셔틀 위치 보기"})).toBeVisible();
  expect(screen.queryByText("현재 표시할 차량 위치 없음")).not.toBeInTheDocument();
  expect(screen.queryByText("위에서 아래로 운행")).not.toBeInTheDocument();
  expect(view.container.querySelector('[data-timeline-vehicle="real-position"]')).toBeInTheDocument();
  const categories=screen.getByRole("group",{name:"시간표 종류"});
  expect(within(categories).getAllByRole("button")).toHaveLength(3);
});
it("shows a labeled estimated segment without inventing a map vehicle",()=>{
  const nowISO="2026-11-02T13:20:00+09:00",now=Date.parse(nowISO),departureAt=now-5*60000;
  const ids=["seokgye-campus-departure","seokgye-hwarangdae-2","seokgye-taereung-6","seokgye-4","seokgye-taereung-7","seokgye-campus-arrival"];
  const stops=ids.map((visitId,index)=>({visitId,departureAt,arrivalAt:departureAt+index*120000,travelSeconds:index*120,tripKey:"planned-seokgye"}));
  predictions.data={status:"learning",arrivals:[],scheduledArrivals:stops,trips:[{key:"planned-seokgye",route:"seokgye",pattern:"online",departureAt,stops}],context:{serviceDate:"2026-11-02",version:testServiceData.version,generatedAt:now,validUntil:now+300000}};
  const data={...testServiceData,nowISO,holidays:{...testServiceData.holidays,lastSuccessAt:nowISO}};
  const view=render(<ShuttleServicePreview data={data}/>);
  expect(screen.getByRole("img",{name:"예상"})).toBeVisible();
  expect(screen.getByRole("region",{name:"전체 정류장 도착예상"})).not.toHaveTextContent(/예상 위치|예정편|시간표 기준|운행 예측|예측 안내|보정 중/);
  expect(eta()).toHaveTextContent("13:21");
  expect(view.container.querySelector('[data-estimated-trip="planned-seokgye"]')).toBeInTheDocument();
  expect(view.container.querySelector('[data-estimated-trip="planned-seokgye"]')).toHaveAttribute("data-progress","2.5");
  expect(view.container.querySelector('[data-estimated-trip="planned-seokgye"] svg image')).toBeInTheDocument();
  expect(view.container.querySelectorAll("[data-timeline-vehicle]")).toHaveLength(0);
  map();expect(screen.getByTestId("received-map")).toHaveAttribute("data-positions","[]");
  predictions.data.arrivals=[{visitId:"seokgye-4",arrivalAt:now+600000,measuredAt:now,validUntil:now+90000}];
  view.rerender(<ShuttleServicePreview data={data}/>);
  expect(eta()).toHaveTextContent("10분 후");
  expect(screen.getByRole("img",{name:"예상"})).toBeInTheDocument();
  expect(screen.getByTestId("received-map")).toHaveAttribute("data-positions","[]");
});
it("shows every overlapping estimated trip when a stop is selected and keeps actual positions separate",()=>{
  const nowISO="2026-11-02T13:20:00+09:00",now=Date.parse(nowISO),departureAt=now-5*60000;
  const data={...testServiceData,nowISO,holidays:{...testServiceData.holidays,lastSuccessAt:nowISO}};
  const trip=(index:number)=>{
    const start=departureAt+index*10000,key=`overlap-${index}`;
    return {key,route:"seokgye" as const,pattern:"online",departureAt:start,
      stops:serviceVisits.seokgye.map((visit,i)=>({visitId:visit.id,departureAt:start,arrivalAt:start+i*120000,travelSeconds:i*120,tripKey:key}))};
  };
  const first=trip(0),second=trip(1),third=trip(2);
  predictions.data={status:"learning",arrivals:[],scheduledArrivals:first.stops,trips:[first,second],
    context:{serviceDate:"2026-11-02",version:data.version,generatedAt:now,validUntil:now+300000}};
  const view=render(<ShuttleServicePreview data={data}/>);
  expect(screen.getAllByRole("img",{name:"예상"})).toHaveLength(2);
  predictions.data.trips=[first,second,third];view.rerender(<ShuttleServicePreview data={data}/>);
  const pins=[...view.container.querySelectorAll<HTMLElement>('[data-estimated-trip]')];
  expect(pins).toHaveLength(3);
  expect(new Set(pins.map(pin=>pin.style.left)).size).toBe(3);
  fireEvent.click(screen.getByRole("button",{name:/화랑대역 \(2번 출구\).*하차/}));
  expect(screen.getAllByRole("img",{name:"예상"})).toHaveLength(3);
  const road=serviceRoadPaths({id:"seokgye"})[0];
  positions.data={success:true,timestamp:nowISO,source:"shuttle",sourceStatus:"fresh",stale:false,
    data:[.2,.6].map((fraction,index)=>{const point=pointAlongPath(road,fraction);return {id:`actual-${index}`,name:"fixture",routeid:2,status:1,lat:String(point[0]),lon:String(point[1])};})};
  view.rerender(<ShuttleServicePreview data={data}/>);
  expect(screen.queryAllByRole("img",{name:"예상"})).toHaveLength(0);
  expect(view.container.querySelectorAll('[data-timeline-vehicle]')).toHaveLength(2);
});
it("hides completed estimates without filtering other active trips when a completed stop is selected",()=>{
  const departure=Date.parse("2026-11-04T13:00:00+09:00"),now=departure+31*60000,nowISO=new Date(now).toISOString();
  const data={...testServiceData,nowISO,holidays:{...testServiceData.holidays,lastSuccessAt:nowISO},
    specialPeriods:{...testServiceData.specialPeriods,specialPeriods:[]},buses:testServiceData.buses.map(bus=>({...bus,schedules:{...bus.schedules,mondayToThursday:["13:00","13:10"]}}))};
  const trip=(key:string,departureAt:number,minutes:number)=>({key,route:"seokgye" as const,pattern:"semester",departureAt,
    stops:serviceVisits.seokgye.map((visit,index)=>({visitId:visit.id,departureAt,arrivalAt:departureAt+index*minutes*60000,travelSeconds:index*minutes*60,tripKey:key}))});
  const forecasts=(earlierMinutes:number,finalMinutes:number)=>{
    const earlier=trip("earlier",departure,earlierMinutes),final=trip("final",departure+10*60000,finalMinutes);
    predictions.data={status:"learning",arrivals:[],scheduledArrivals:earlier.stops,trips:[earlier,final],
      context:{serviceDate:"2026-11-04",version:data.version,generatedAt:now,validUntil:now+300000}};
  };
  forecasts(12,2);
  const view=render(<ShuttleServicePreview data={data}/>);
  expect(eta()).toHaveTextContent("막차 도착");
  expect(screen.queryByRole("img",{name:"예상"})).not.toBeInTheDocument();
  forecasts(40,4);view.rerender(<ShuttleServicePreview data={data}/>);
  expect(screen.getByRole("img",{name:"예상"})).toBeInTheDocument();
  const completed=screen.getByRole("button",{name:/화랑대역 \(2번 출구\).*하차/});
  expect(completed).toHaveTextContent("막차 도착");
  fireEvent.click(completed);
  expect(screen.getByRole("img",{name:"예상"})).toBeInTheDocument();
});
it("retries a persistent timetable mismatch after the refresh throttle without refreshing every clock tick",()=>{
  const nowISO="2026-11-02T13:20:00+09:00",now=Date.parse(nowISO),data={...testServiceData,nowISO,holidays:{...testServiceData.holidays,lastSuccessAt:nowISO}};
  vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(now);
  predictions.data.context={serviceDate:"2026-11-02",version:"updated",generatedAt:now,validUntil:now+300000};
  const {rerender,unmount}=render(<ShuttleServicePreview data={data}/>);
  const tick=vi.mocked(setInterval).mock.calls.find(call=>call[1]===1000)![0] as ()=>void;
  try {
    expect(refresh).toHaveBeenCalledTimes(1);
    act(()=>{vi.setSystemTime(now+1000);tick();});
    expect(refresh).toHaveBeenCalledTimes(1);
    act(()=>{vi.setSystemTime(now+30000);tick();});
    predictions.data.context.version=data.version;rerender(<ShuttleServicePreview data={data}/>);
    predictions.data.context.version="another-update";rerender(<ShuttleServicePreview data={data}/>);
    expect(refresh).toHaveBeenCalledTimes(1);
    act(()=>{vi.setSystemTime(now+60000);tick();});
    expect(refresh).toHaveBeenCalledTimes(2);
    act(()=>{vi.setSystemTime(now+61000);tick();});
    expect(refresh).toHaveBeenCalledTimes(2);
  } finally {unmount();vi.useRealTimers();}
});
it("refreshes a mismatched timetable once, and refreshes again after a long hidden interval",()=>{
  const nowISO="2026-11-02T13:20:00+09:00",now=Date.parse(nowISO),data={...testServiceData,nowISO,holidays:{...testServiceData.holidays,lastSuccessAt:nowISO}};
  vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(now);
  predictions.data.context={serviceDate:"2026-11-02",version:"updated",generatedAt:now,validUntil:now+300000};
  const {rerender,unmount}=render(<ShuttleServicePreview data={data}/>);
  try {
    expect(refresh).toHaveBeenCalledTimes(1);
    rerender(<ShuttleServicePreview data={{...data}}/>);
    expect(refresh).toHaveBeenCalledTimes(1);
    const hidden=vi.spyOn(document,"hidden","get").mockReturnValue(true);
    fireEvent(document,new Event("visibilitychange"));
    vi.setSystemTime(now+61000);hidden.mockReturnValue(false);
    fireEvent(document,new Event("visibilitychange"));
    expect(refresh).toHaveBeenCalledTimes(2);
  } finally {unmount();vi.useRealTimers();}
});
it("fills the timetable category row when only semester remains",()=>{
  const nowISO="2026-11-02T13:20:00+09:00";
  const data={...testServiceData,nowISO,holidays:{...testServiceData.holidays,lastSuccessAt:nowISO}};
  const view=render(<ShuttleServicePreview data={data}/>);
  fireEvent.click(screen.getByRole("button",{name:/^온라인수업 권장 주간/}));
  view.rerender(<ShuttleServicePreview data={{...data,specialPeriods:{...data.specialPeriods,specialPeriods:[]}}}/>);
  const categories=screen.getByRole("group",{name:"시간표 종류"});
  expect(categories).toHaveAttribute("data-category-count","1");
  expect(within(categories).getAllByRole("button")).toHaveLength(1);
  expect(within(categories).getByRole("button",{name:"학기중 현재"})).toHaveAttribute("aria-pressed","true");
});
it("shows only the ordinary categories after a special timetable ends",()=>{
  const nowISO="2026-11-25T13:20:00+09:00";
  render(<ShuttleServicePreview data={{...testServiceData,nowISO,holidays:{...testServiceData.holidays,lastSuccessAt:nowISO}}}/>);
  const categories=()=>screen.getByRole("group",{name:"시간표 종류"});
  expect(categories()).toHaveAttribute("data-category-count","1");
  expect(within(categories()).queryByRole("button",{name:/온라인|특별/})).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button",{name:"화랑대역 학교행"}));
  expect(categories()).toHaveAttribute("data-category-count","2");
  expect(within(categories()).getByRole("button",{name:"방학"})).toBeVisible();
  fireEvent.click(screen.getByRole("button",{name:"별내역 순환"}));
  expect(categories()).toHaveAttribute("data-category-count","1");
  expect(within(categories()).queryByRole("button",{name:"방학"})).not.toBeInTheDocument();
});
it("preserves the selected exam date across routes and resets it on each Korea midnight",()=>{
  const nowISO="2026-11-22T23:59:59+09:00",now=Date.parse(nowISO);
  const data={...testServiceData,nowISO,holidays:{...testServiceData.holidays,lastSuccessAt:nowISO}};
  vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(now);
  const view=render(<ShuttleServicePreview surface="production" data={data}/>);
  const tick=vi.mocked(setInterval).mock.calls.find(call=>call[1]===1000)![0] as ()=>void;
  try {
    fireEvent.click(screen.getByRole("button",{name:"특별운행"}));
    fireEvent.click(screen.getByRole("button",{name:"11/24(화)"}));
    fireEvent.click(screen.getByRole("button",{name:"별내역 순환"}));
    expect(screen.getByRole("button",{name:"11/24(화)"})).toHaveAttribute("aria-pressed","true");
    act(()=>{vi.setSystemTime(Date.parse("2026-11-23T00:00:00+09:00"));tick();});
    expect(screen.getByRole("button",{name:"특별운행 현재"})).toHaveAttribute("aria-pressed","true");
    expect(screen.getByRole("button",{name:"11/23(월)"})).toHaveAttribute("aria-pressed","true");
    fireEvent.click(screen.getByRole("button",{name:"학기중"}));
    act(()=>{vi.setSystemTime(Date.parse("2026-11-24T00:00:00+09:00"));tick();});
    expect(screen.getByRole("button",{name:"특별운행 현재"})).toHaveAttribute("aria-pressed","true");
    expect(screen.getByRole("button",{name:"11/24(화)"})).toHaveAttribute("aria-pressed","true");
    act(()=>{vi.setSystemTime(Date.parse("2026-11-25T00:00:00+09:00"));tick();});
    expect(screen.getByRole("button",{name:"학기중 현재"})).toHaveAttribute("aria-pressed","true");
    expect(screen.queryByRole("button",{name:/특별운행/})).not.toBeInTheDocument();
  } finally {view.unmount();vi.useRealTimers();}
});
it.each([
  ["12:59:59","운행 전"],["13:00:00","운행 중"],["14:00:00","운행 중"],["15:00:00","운행 중"],["15:00:01","운행 종료"],
])("computes badges immediately from timetable boundaries at %s despite stale calendar or positions",(time,label)=>{
  const nowISO=`2026-11-03T${time}+09:00`;
  positions.isError=true;positions.data!.timestamp=nowISO;positions.data!.data=[{id:"cached",name:"cached",routeid:2,status:1,lat:"37.62",lon:"127.08"}];
  const buses=testServiceData.buses.map(bus=>({...bus,schedules:{...bus.schedules,mondayToThursday:["13:00","15:00"]}}));
  render(<ShuttleServicePreview data={{...testServiceData,buses,nowISO,holidays:{...testServiceData.holidays,stale:true},specialPeriods:{...testServiceData.specialPeriods,specialPeriods:[]}}}/>);
  const button=screen.getByRole("button",{name:"석계역 순환"});
  expect(document.getElementById(button.getAttribute("aria-describedby")!)).toHaveTextContent(label);
  expect(screen.queryByText("확인 중")).not.toBeInTheDocument();
});
