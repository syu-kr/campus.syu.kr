import { useLocale } from "@/app/components/LocaleProvider";
import { ShuttleUpcomingDeparturesCard } from "@/app/features/shuttle/ShuttleUpcomingDeparturesCard";
import { getShuttlePreviewCopy } from "@/lib/i18n/shuttle-preview";
import { getCurrentShuttleSummary } from "@/lib/shuttle-schedule";
import { koreaDateKey } from "./preview-timetable";
import { serviceRoutes, type ShuttleServiceData } from "./service-data";
import { winterDepartures, winterVacation } from "./published-vacation";

export default function ShuttleUpcomingDepartures({ data, now }: { data: ShuttleServiceData; now: Date }) {
  const locale=useLocale();
  const copy=getShuttlePreviewCopy(locale);
  const date=koreaDateKey(now);
  const buses=data.buses.map(bus=>{
    const route=serviceRoutes.find(item=>item.scheduleId===bus.id);
    if (!route) return bus;
    const routeName=route.oneWay?`${copy[route.name]} → ${copy.school}`:`${copy.school} → ${copy[route.name]}`;
    return {...bus,routeName};
  });
  const hasPublishedWinter=data.specialPeriods.vacationPeriods?.some(p=>p.startDate===winterVacation.startDate&&p.endDate===winterVacation.endDate);
  const inbound=data.buses.find(bus=>bus.id===serviceRoutes[0].scheduleId);
  const hasCampusOutbound=buses.some(bus=>bus.startLocation===inbound?.endLocation&&bus.endLocation===inbound?.startLocation
    && (bus.schedules.mondayToThursdayVacation.length>0 || bus.schedules.fridayVacation.length>0));
  if(hasPublishedWinter && date>=winterVacation.startDate && date<=winterVacation.endDate && !hasCampusOutbound){
    buses.push({id:"winter-campus-hwarangdae",routeName:`${copy.school} → ${copy.hwarangdae}`,startLocation:copy.school,endLocation:copy.hwarangdae,lastUpdated:"",
      schedules:{mondayToThursday:[],friday:[],mondayToThursdayVacation:winterDepartures.weekdays.campus,fridayVacation:winterDepartures.friday.campus}});
  }
  const {departures}=getCurrentShuttleSummary({buses,specialPeriods:data.specialPeriods,holidays:data.holidays,now,limit:buses.length+2});
  const upcoming=departures.filter(item=>item.minutesUntil<=30);
  return data.source==="unavailable" ? null : <ShuttleUpcomingDeparturesCard departures={upcoming} />;
}
