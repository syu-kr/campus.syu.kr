import { describe, expect, it } from "vitest";
import type { ShuttleSpecialPeriods } from "@/types";
import { previewRoutes } from "./preview-data";
import { groupDepartures, koreaDateKey, previewCalendar, previewHolidays, previewNow, previewTimetable, shiftPreviewDate, sortedDepartures, upcomingDepartures, validPreviewDate } from "./preview-timetable";

const [hwarangdae,seokgye,byeollae]=previewRoutes;
const now=previewNow(0);
const query=(date:string,options:Partial<Parameters<typeof previewTimetable>[0]>={})=>previewTimetable({route:seokgye,date,now,...options});

describe("preview timetable dates and departures",()=>{
  it("normalizes, sorts and deduplicates only valid departure times",()=>{
    const times=["13:30","9:05","09:05","12:00","24:00","12:60","bad"];
    expect(sortedDepartures(times)).toEqual(["09:05","12:00","13:30"]);
    expect(groupDepartures([...times,"12:45"])).toEqual([{hour:"09",times:["09:05"]},{hour:"12",times:["12:00","12:45"]},{hour:"13",times:["13:30"]}]);
    expect(times).toHaveLength(7);
  });
  it("compares exact instants and never calls a past departure upcoming",()=>{
    const times=["12:00","12:30","13:00","13:30"];
    expect(upcomingDepartures(times,"2026-10-30",new Date(now.getTime()-1))[0].seconds).toBe(0.001);
    expect(upcomingDepartures(times,"2026-10-30",now)).toEqual([
      {time:"12:00",seconds:0,last:false},{time:"12:30",seconds:1800,last:false},{time:"13:00",seconds:3600,last:false},
    ]);
    expect(upcomingDepartures(times,"2026-10-30",new Date(now.getTime()+1))[0].time).toBe("12:30");
  });
  it("returns only remaining entries and marks the actual last departure",()=>{
    expect(upcomingDepartures(["12:00","12:30"],"2026-10-30",now)).toHaveLength(2);
    expect(upcomingDepartures(["12:00"],"2026-10-30",now)).toEqual([{time:"12:00",seconds:0,last:true}]);
    expect(upcomingDepartures(["12:00"],"2026-10-30",previewNow(1))).toEqual([]);
    expect(upcomingDepartures([],"2026-10-30",now)).toEqual([]);
  });
  it("uses Korean midnight and validates calendar dates",()=>{
    expect(koreaDateKey(new Date("2026-10-30T14:59:59Z"))).toBe("2026-10-30");
    expect(koreaDateKey(new Date("2026-10-30T15:00:00Z"))).toBe("2026-10-31");
    expect(upcomingDepartures(["00:00"],"2026-10-31",new Date("2026-10-30T14:59:59Z"))[0].seconds).toBe(1);
    expect(shiftPreviewDate("2026-12-31",1)).toBe("2027-01-01");
    expect(validPreviewDate("2028-02-29")).toBe(true);
    for(const value of ["2026-02-29","2026-13-01","2026-1-01",""]) expect(validPreviewDate(value)).toBe(false);
  });
});

describe("preview timetable calendar selection",()=>{
  it("uses separate weekday and Friday schedules",()=>{
    expect(query("2026-10-29",{specialEnabled:false}).times.at(-1)).toBe("17:30");
    expect(query("2026-10-30",{specialEnabled:false})).toMatchObject({scheduleType:"friday",activeType:"regular"});
    expect(query("2026-10-30",{specialEnabled:false}).times.at(-1)).toBe("15:00");
  });
  it("applies special start/end dates only to included routes",()=>{
    expect(query("2026-10-27").activeType).toBe("regular");
    expect(query("2026-10-28").activeType).toBe("special");
    expect(query("2026-11-02").times.at(-1)).toBe("14:15");
    expect(query("2026-11-03").activeType).toBe("regular");
    expect(query("2026-10-30",{route:hwarangdae}).times).toEqual(["12:00","12:20","12:40"]);
    expect(query("2026-10-30",{route:byeollae}).activeType).toBe("regular");
    expect(query("2026-10-30",{route:byeollae,view:"special"}).status).toBe("no-special");
  });
  it("changes only the reference table when another schedule is selected",()=>{
    expect(query("2026-10-30",{view:"regular"})).toMatchObject({activeType:"special",type:"regular",reference:true});
    expect(query("2026-10-30").times).toEqual(["12:00","12:45","13:30"]);
  });
  it("selects vacation weekday and Friday without inventing semester times",()=>{
    expect(query("2026-12-17")).toMatchObject({scheduleType:"mondayToThursdayVacation",times:["12:00","13:00","14:00"]});
    expect(query("2026-12-18")).toMatchObject({scheduleType:"fridayVacation",times:["12:00","13:00"]});
  });
  it("separates closures, unavailable schedules and unconfirmed coverage",()=>{
    for(const date of ["2026-10-31","2026-11-01","2026-12-25"]) expect(query(date)).toMatchObject({status:"closed",times:[]});
    expect(query("2027-01-13")).toMatchObject({status:"unavailable",times:[]});
    expect(query("2028-01-03")).toMatchObject({status:"unknown",times:[]});
    expect(query("2026-11-03",{now:new Date("2026-11-04T00:00:00+09:00")})).toMatchObject({status:"unknown",times:[]});
    expect(query("invalid").times).toEqual([]);
  });
  it("honors verified service exceptions only for the matching route",()=>{
    const calendar:ShuttleSpecialPeriods={...previewCalendar,serviceExceptions:[{
      date:"2026-10-31",routeId:seokgye.id,times:["13:00","12:00"],
      sourceUrl:"https://www.syu.ac.kr/test-fixture",verifiedAt:"2026-10-29T00:00:00Z",
    }]};
    expect(query("2026-10-31",{calendar})).toMatchObject({status:"ready",activeType:"special",times:["12:00","13:00"]});
    expect(query("2026-10-31",{calendar,route:byeollae})).toMatchObject({status:"closed",times:[]});
    const invalid={...calendar,serviceExceptions:calendar.serviceExceptions!.map(item=>({...item,sourceUrl:"https://example.invalid"}))};
    expect(query("2026-10-31",{calendar:invalid}).status).toBe("closed");
  });
  it("does not mutate fixtures while selecting dates and reference tables",()=>{
    const before=JSON.stringify({previewCalendar,previewHolidays,previewRoutes});
    query("2026-10-30",{view:"regular"});query("2026-11-02");query("2026-12-18");
    expect(JSON.stringify({previewCalendar,previewHolidays,previewRoutes})).toBe(before);
  });
});
