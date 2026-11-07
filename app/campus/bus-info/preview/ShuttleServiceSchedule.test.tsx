import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it } from "vitest";
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
