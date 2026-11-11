import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
import { LocaleProvider } from "@/app/components/LocaleProvider";
import ShuttleServiceSchedule from "./ShuttleServiceSchedule";
import { serviceRoutes } from "./service-data";
import { testServiceData } from "./service-test-data";
import { getShuttleServiceCopy } from "@/lib/i18n/shuttle-service-preview";

const route=serviceRoutes[0];
function dataAt(nowISO:string){
  return {...testServiceData,nowISO,holidays:{...testServiceData.holidays,lastSuccessAt:nowISO},
    specialPeriods:{...testServiceData.specialPeriods,specialPeriods:[]},
    buses:testServiceData.buses.map(bus=>({...bus,schedules:{...bus.schedules,
      mondayToThursday:["08:10","08:20","08:30"],friday:["09:00","10:00"]}}))};
}
function slot(time:string,label="학기중"){
  return within(screen.getByRole("list",{name:label})).getByText(time).closest("li")!;
}
it("marks passed times and only the first upcoming departure on today's timetable",()=>{
  const nowISO="2026-11-05T08:15:00+09:00";
  const {container}=render(<ShuttleServiceSchedule route={route} now={new Date(nowISO)} data={dataAt(nowISO)}/>);
  expect(slot("08:10")).toHaveAttribute("data-past","true");
  expect(slot("08:20")).toHaveAttribute("data-past","false");
  expect(slot("08:20")).toHaveAttribute("data-next","true");
  expect(slot("08:20")).toHaveAttribute("aria-current","true");
  expect(slot("08:30")).toHaveAttribute("data-next","false");
  expect(container.querySelectorAll('[data-next="true"]')).toHaveLength(1);
});
it("advances the highlight only after the departure instant and clears it after the last departure",()=>{
  const nowISO="2026-11-05T08:10:00+09:00",data=dataAt(nowISO);
  const {rerender,container}=render(<ShuttleServiceSchedule route={route} now={new Date(nowISO)} data={data}/>);
  expect(slot("08:10")).toHaveAttribute("data-next","true");
  rerender(<ShuttleServiceSchedule route={route} now={new Date("2026-11-05T08:10:00.001+09:00")} data={data}/>);
  expect(slot("08:10")).toHaveAttribute("data-past","true");
  expect(slot("08:20")).toHaveAttribute("data-next","true");
  rerender(<ShuttleServiceSchedule route={route} now={new Date("2026-11-05T08:30:00.001+09:00")} data={data}/>);
  expect(container.querySelectorAll('[data-next="true"]')).toHaveLength(0);
  expect(container.querySelectorAll('[data-past="true"]')).toHaveLength(3);
});
it("leaves reference weekday tables unmarked",()=>{
  const nowISO="2026-11-05T12:00:00+09:00";
  const {container}=render(<ShuttleServiceSchedule route={route} now={new Date(nowISO)} data={dataAt(nowISO)}/>);
  fireEvent.click(screen.getByRole("button",{name:"금요일"}));
  expect(slot("09:00")).toHaveAttribute("data-past","false");
  expect(container.querySelectorAll('[data-next="true"]')).toHaveLength(0);
});
it("restores today's exceptional departure highlight after viewing a different weekday",()=>{
  const nowISO="2026-11-05T08:15:00+09:00",base=dataAt(nowISO);
  const data={...base,specialPeriods:{...base.specialPeriods,serviceExceptions:[{
    date:"2026-11-05",routeId:route.scheduleId,times:["08:10","08:20"],
    sourceUrl:"https://www.syu.ac.kr/school-life/school-bus/",verifiedAt:"2026-11-04",
  }]}};
  render(<ShuttleServiceSchedule route={route} now={new Date(nowISO)} data={data}/>);
  fireEvent.click(screen.getByRole("button",{name:"학기중"}));
  fireEvent.click(screen.getByRole("button",{name:"금요일"}));
  const special=getShuttleServiceCopy("ko").specialName;
  fireEvent.click(screen.getByRole("button",{name:`${special} 현재`}));
  expect(slot("08:10",special)).toHaveAttribute("data-past","true");
  expect(slot("08:20",special)).toHaveAttribute("data-next","true");
});
it("puts the campus winter timetable before the station timetable and marks their own next departures",()=>{
  const nowISO="2026-12-15T08:25:00+09:00";
  render(<ShuttleServiceSchedule route={route} now={new Date(nowISO)} data={dataAt(nowISO)}/>);
  const campus=screen.getByRole("list",{name:"학교 출발"}),station=screen.getByRole("list",{name:"화랑대역 5번 출구 출발"});
  expect(campus.compareDocumentPosition(station)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(slot("08:20","학교 출발")).toHaveAttribute("data-past","true");
  expect(slot("09:10","학교 출발")).toHaveAttribute("data-next","true");
  expect(slot("08:30","화랑대역 5번 출구 출발")).toHaveAttribute("data-next","true");
  fireEvent.click(screen.getByRole("button",{name:"금요일"}));
  expect(campus.lastElementChild).toHaveTextContent("14:10");
  expect(station.lastElementChild).toHaveTextContent("14:30");
  expect(campus.compareDocumentPosition(station)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
const [hwarangdae,seokgye,byeollae]=serviceRoutes;
function currentData(nowISO:string) {
  return {...testServiceData,nowISO,holidays:{...testServiceData.holidays,lastSuccessAt:nowISO}};
}
it("offers both exam dates in advance while the semester table remains current",()=>{
  const data=currentData("2026-11-11T13:00:00+09:00");
  render(<ShuttleServiceSchedule route={seokgye} now={new Date(data.nowISO)} data={data}/>);
  expect(screen.getByRole("button",{name:"학기중 현재"})).toHaveAttribute("aria-pressed","true");
  fireEvent.click(screen.getByRole("button",{name:"특별운행"}));
  expect(screen.getByRole("heading",{name:"논술 특별시간표"})).toBeVisible();
  expect(screen.getByRole("button",{name:"11/23(월)"})).toHaveAttribute("aria-pressed","true");
  expect(screen.getByRole("list",{name:"논술 특별시간표"}).firstElementChild).toHaveTextContent("14:00");
  fireEvent.click(screen.getByRole("button",{name:"11/24(화)"}));
  expect(screen.getByRole("list",{name:"논술 특별시간표"}).firstElementChild).toHaveTextContent("12:00");
  expect(screen.queryByText("오늘 적용")).not.toBeInTheDocument();
  expect(screen.queryByText(/학기중 시간표와 동일/)).not.toBeInTheDocument();
  expect(screen.getByRole("link",{name:"특별운행 공지"})).toHaveAttribute("href",expect.stringContaining("안내11-23-11-24"));
});
it("keeps the current tag independent of manual category, weekday and date choices, including route changes",()=>{
  const data=currentData("2026-11-23T14:10:00+09:00"),now=new Date(data.nowISO);
  const view=render(<ShuttleServiceSchedule route={seokgye} now={now} data={data}/>);
  expect(screen.getByRole("button",{name:"특별운행 현재"})).toHaveAttribute("aria-pressed","true");
  expect(screen.getByText("오늘 적용")).toBeVisible();
  expect(view.container.querySelector('[data-next="true"]')).toHaveTextContent("14:30");
  fireEvent.click(screen.getByRole("button",{name:"학기중"}));
  fireEvent.click(screen.getByRole("button",{name:"금요일"}));
  expect(screen.getByRole("list",{name:"학기중"})).toHaveTextContent("15:30");
  expect(screen.getByRole("button",{name:"특별운행 현재"})).toHaveAttribute("aria-pressed","false");
  expect(screen.queryByText("오늘 적용")).not.toBeInTheDocument();
  expect(screen.getByText("실제 출발·도착예상은 오늘 적용 시간표를 따릅니다.")).toBeVisible();
  fireEvent.click(screen.getByRole("button",{name:"특별운행 현재"}));
  expect(screen.getByText("오늘 적용")).toBeVisible();
  fireEvent.click(screen.getByRole("button",{name:"11/24(화)"}));
  expect(screen.queryByText("오늘 적용")).not.toBeInTheDocument();
  expect(view.container.querySelector('[data-next="true"]')).not.toBeInTheDocument();
  view.rerender(<ShuttleServiceSchedule route={byeollae} now={now} data={data}/>);
  expect(screen.getByRole("button",{name:"11/24(화)"})).toHaveAttribute("aria-pressed","true");
  expect(screen.getByRole("list",{name:"논술 특별시간표"}).firstElementChild).toHaveTextContent("09:30");
});
it("distinguishes an explicitly suspended route from unavailable timetable data",()=>{
  const data=currentData("2026-11-23T09:00:00+09:00"),now=new Date(data.nowISO);
  const view=render(<ShuttleServiceSchedule route={hwarangdae} now={now} data={data}/>);
  expect(screen.getByText("선택한 날짜는 운휴일입니다.")).toBeVisible();
  expect(screen.queryByRole("list",{name:"논술 특별시간표"})).not.toBeInTheDocument();
  view.rerender(<ShuttleServiceSchedule route={hwarangdae} now={now} data={{...data,source:"unavailable"}}/>);
  fireEvent.click(screen.getByRole("button",{name:"특별운행"}));
  expect(screen.getByText("시간표 자료를 불러오지 못했습니다.")).toBeVisible();
  expect(screen.queryByText("선택한 날짜는 운휴일입니다.")).not.toBeInTheDocument();
});
it("labels the exam dates and timetable in English",()=>{
  const data=currentData("2026-11-24T09:00:00+09:00");
  render(<LocaleProvider locale="en"><ShuttleServiceSchedule route={hwarangdae} now={new Date(data.nowISO)} data={data}/></LocaleProvider>);
  expect(screen.getByRole("button",{name:"Special service Current"})).toHaveAttribute("aria-pressed","true");
  expect(screen.getByRole("heading",{name:"Essay exam timetable"})).toBeVisible();
  expect(screen.getByRole("button",{name:"11/24(Tue)"})).toHaveAttribute("aria-pressed","true");
  expect(screen.getByRole("button",{name:"11/23(Mon)"})).toBeVisible();
  expect(screen.getByText("Applies today")).toBeVisible();
});
