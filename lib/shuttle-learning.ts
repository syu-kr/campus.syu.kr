import roadData from "../app/campus/bus-info/preview/data/service-road-paths.json";
import { serviceVisits, type ShuttleRoute } from "./shuttle-visits";
import { etaServiceDate, type StopEta, type ScheduledStopArrival, type ScheduledShuttleTrip } from "./shuttle-eta";
import { getKoreaDateTimeParts } from "./korea-time";
import type { PilotEvent, PilotObservation } from "./shuttle-observations";

type Point = readonly number[];
type TimingProfile = { seconds: number; n: number; cells: Record<string, { seconds: number; n: number; at: number }> };
export type TimingProfiles = Record<string, TimingProfile>;
type Run = PilotObservation & { runId: string; leg: number; fraction: number; paceSeconds: number | null; stationary: boolean };
export type LearningState = { receivedAt: number; runs: Run[]; profiles: TimingProfiles; pending: PilotEvent[]; learned: { key: string; at: number }[] };
export type LearningPoint = PilotObservation & { runId: string | null; advanced: boolean };
export type DeparturePlans = Partial<Record<number, number[]>>;
const routes: Record<number, ShuttleRoute> = {1:"hwarangdae",2:"seokgye",3:"byeollae"};
// Stored OSRM road references (2026-10-31), not bus observations or demonstration timings.
const roadSeconds: Record<ShuttleRoute, number[]> = {hwarangdae:[410.9],seokgye:[389.3,56.5,69.4,83.1,454.1],byeollae:[332.3,497]};
const paths = roadData.paths as Record<string, number[][][]>;
const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
function directionLegs(routeId:number,status:number) {return routeId===1?(status===2?[0]:[]):routeId===2?(status===1?[0,1,2]:[3,4]):routeId===3?(status===1?[0]:[1]):[];}
function distance(a: Point, b: Point) { return Math.hypot((b[0]-a[0])*111_195,(b[1]-a[1])*111_195*Math.cos(a[0]*Math.PI/180)); }
export function projectShuttlePoint(point: Point, path: Point[]) {
  const lengths=path.slice(1).map((p,i)=>distance(path[i],p)), total=lengths.reduce((a,b)=>a+b,0);
  let walked=0,best={distance:Infinity,fraction:0};
  for(let i=0;i<lengths.length;i++) {
    const a=path[i],b=path[i+1],scale=Math.cos(point[0]*Math.PI/180);
    const x=(b[1]-a[1])*scale,y=b[0]-a[0],px=(point[1]-a[1])*scale,py=point[0]-a[0];
    const f=Math.max(0,Math.min(1,(px*x+py*y)/(x*x+y*y||1)));
    const d=distance(point,[a[0]+(b[0]-a[0])*f,a[1]+(b[1]-a[1])*f]);
    if(d<best.distance)best={distance:d,fraction:total?(walked+lengths[i]*f)/total:0};
    walked+=lengths[i];
  }
  return best;
}
function cellKey(pattern: string, at: number) {
  const p=getKoreaDateTimeParts(new Date(at));return `${pattern}:${p.dayOfWeek}:${p.hour*2+Math.floor(p.minute/30)}`;
}
export function recordTravel(profiles: TimingProfiles, from: string, seconds: number, at: number, pattern: string) {
  if(!finite(seconds)||seconds<=0||seconds>7200||!Number.isSafeInteger(at))return;
  const old=profiles[from],key=cellKey(pattern,at),cell=old?.cells[key];
  const cells={...old?.cells,[key]:{seconds:cell?cell.seconds*.8+seconds*.2:seconds,n:(cell?.n??0)+1,at}};
  // shortcut: retain 64 recent time cells per leg; expand only after observing useful coverage.
  const bounded=Object.fromEntries(Object.entries(cells).sort((a,b)=>b[1].at-a[1].at).slice(0,64));
  profiles[from]={seconds:old?old.seconds*.8+seconds*.2:seconds,n:(old?.n??0)+1,cells:bounded};
}
function timeProfile(profile: TimingProfile | undefined, pattern: string, at: number) {
  if(!profile||!finite(profile.seconds)||profile.seconds<=0||profile.seconds>7200)return null;
  const candidate=profile.cells?.[cellKey(pattern,at)]??profile.cells?.[cellKey("history",at)];
  const cell=candidate&&finite(candidate.seconds)&&candidate.seconds>0&&candidate.seconds<=7200&&Number.isSafeInteger(candidate.n)&&candidate.n>0?candidate:undefined;
  const weight=cell?cell.n/(cell.n+5):0;
  return cell?profile.seconds*(1-weight)+cell.seconds*weight:profile.seconds;
}
function legTime(from: string, fallback: number, pattern: string, at: number, live: TimingProfiles, history: TimingProfiles) {
  const historical=timeProfile(history[from],pattern,at),prior=historical??fallback,observed=timeProfile(live[from],pattern,at);
  const count=live[from]?.n,n=observed!==null&&Number.isSafeInteger(count)&&count>0?count:0;
  const weight=n/(n+5);
  return {seconds:observed===null?prior:prior*(1-weight)+observed*weight,basis:n?"observed" as const:historical!==null?"history" as const:"route" as const};
}
export function scheduledShuttleTrips(live: TimingProfiles, history: TimingProfiles, plans: DeparturePlans, patterns: Partial<Record<number, string>>, now: number): ScheduledShuttleTrip[] {
  const selected: ScheduledShuttleTrip[] = [];
  for (const [id, departures] of Object.entries(plans)) {
    const route = routes[Number(id)], pattern = patterns[Number(id)];
    if (!route || !pattern || !departures) continue;
    const visits = serviceVisits[route];
    const trips: ScheduledShuttleTrip[] = [];
    for (const departureAt of [...new Set(departures)].sort((a,b)=>a-b)) {
      if (!Number.isSafeInteger(departureAt) || etaServiceDate(departureAt) !== etaServiceDate(now)) continue;
      const key = `${etaServiceDate(now)}:${route}:${pattern}:${departureAt}`;
      const stops: ScheduledStopArrival[] = [];
      let arrivalAt = departureAt;
      let basis: ScheduledStopArrival["basis"] = "route";
      for (let index = 0; index < visits.length; index++) {
        if (index > 0) {
          if (index > 1) arrivalAt += legTime(`${visits[index - 1].id}:dwell`, 30, pattern, arrivalAt, live, history).seconds * 1000;
          const leg = legTime(visits[index - 1].id, roadSeconds[route][index - 1], pattern, arrivalAt, live, history);
          arrivalAt += leg.seconds * 1000;
          basis = index === 1 ? leg.basis : basis === "route" || leg.basis === "route" ? "route" : basis === "history" || leg.basis === "history" ? "history" : "observed";
        }
        if (etaServiceDate(arrivalAt) !== etaServiceDate(now)) continue;
        stops.push({
          visitId: visits[index].id, departureAt, arrivalAt: Math.round(arrivalAt), travelSeconds: Math.round((arrivalAt - departureAt) / 1000),
          tripKey: key, basis,
        });
      }
      if (stops.length === visits.length) trips.push({key,route,pattern,departureAt,stops});
    }
    const active=trips.filter(trip=>trip.departureAt<=now&&trip.stops.at(-1)!.arrivalAt>=now);
    const next=trips.find(trip=>trip.departureAt>now);
    const last=[...trips].reverse().find(trip=>trip.stops.at(-1)!.arrivalAt<now);
    selected.push(...active,...(next?[next]:[]),...(last?[last]:[]));
  }
  return selected;
}
export function scheduledShuttleArrivals(live: TimingProfiles, history: TimingProfiles, plans: DeparturePlans, patterns: Partial<Record<number, string>>, now: number): ScheduledStopArrival[] {
  return nextScheduledShuttleArrivals(scheduledShuttleTrips(live,history,plans,patterns,now),now);
}
export function nextScheduledShuttleArrivals(trips: ScheduledShuttleTrip[], now: number): ScheduledStopArrival[] {
  const next=new Map<string,ScheduledStopArrival>();
  for(const trip of trips) for(const stop of trip.stops) {
    const old=next.get(stop.visitId);
    if(!old||(stop.arrivalAt>=now?old.arrivalAt<now||old.arrivalAt>stop.arrivalAt:old.arrivalAt<now&&old.arrivalAt<stop.arrivalAt)) next.set(stop.visitId,stop);
  }
  return [...next.values()];
}
export function advanceShuttleLearning(value: LearningState | undefined, points: LearningPoint[], events: PilotEvent[], receipt: number): LearningState {
  const previous=value?.receivedAt&&value.receivedAt<=receipt?value:undefined;
  if(value&&value.receivedAt>receipt)return value;
  const profiles: TimingProfiles=structuredClone(previous?.profiles??{});
  const pending=[...(previous?.pending??[]),...events].filter(e=>receipt-e.observedAt<2*3600_000);
  const learned=(previous?.learned??[]).filter(e=>receipt-e.at<2*3600_000);
  for(const arrival of events.filter(e=>e.event==="arrival")) {
    const route=routes[arrival.routeId],visits=route?serviceVisits[route]:[],index=visits.findIndex(v=>v.id===arrival.visitId);
    if(index<1)continue;
    const departure=pending.find(e=>e.runId===arrival.runId&&e.status===arrival.status&&e.pattern===arrival.pattern&&e.visitId===visits[index-1].id&&e.event==="departure"&&e.method===arrival.method&&e.observedAt<arrival.observedAt);
    const key=`${arrival.runId}:${visits[index-1].id}`;
    if(departure&&!learned.some(e=>e.key===key)&&etaServiceDate(departure.observedAt)===etaServiceDate(arrival.observedAt)) {
      recordTravel(profiles,visits[index-1].id,(arrival.observedAt-departure.observedAt)/1000,departure.observedAt,arrival.pattern);
      learned.push({key,at:arrival.observedAt});
    }
  }
  for(const departure of events.filter(e=>e.event==="departure")) {
    const arrival=pending.find(e=>e.runId===departure.runId&&e.visitId===departure.visitId&&e.event==="arrival"&&e.method===departure.method&&e.observedAt<departure.observedAt);
    const key=`${departure.runId}:${departure.visitId}:dwell`;
    if(arrival&&!learned.some(e=>e.key===key)) {recordTravel(profiles,`${departure.visitId}:dwell`,(departure.observedAt-arrival.observedAt)/1000,arrival.observedAt,departure.pattern);learned.push({key,at:departure.observedAt});}
  }
  const runs: Run[]=[];
  for(const point of points) {
    if(!point.advanced) {const retained=previous?.runs.find(r=>r.vehicleKey===point.vehicleKey&&r.runId===point.runId);if(retained)runs.push(retained);continue;}
    if(!point.runId||point.routeId===1&&point.status!==2)continue;
    const route=routes[point.routeId];if(!route||!finite(point.lat)||!finite(point.lon))continue;
    const prior=previous?.runs.find(r=>r.vehicleKey===point.vehicleKey&&r.runId===point.runId);
    const indices=directionLegs(point.routeId,point.status);
    const matches=indices.map(leg=>({leg,...projectShuttlePoint([point.lat,point.lon],paths[route][leg])}))
      .filter(m=>m.distance<=200&&(!prior||m.leg>=prior.leg&&(m.leg!==prior.leg||m.fraction>=prior.fraction-.1)))
      .sort((a,b)=>a.distance-b.distance);
    const match=matches[0];if(!match)continue;
    let paceSeconds=prior?.paceSeconds??null;
    if(prior&&match.leg===prior.leg) {
      const dt=(point.observedAt-prior.observedAt)/1000,df=match.fraction-prior.fraction;
      if(dt>=5&&dt<=120&&df>=.005&&df<.5) {
        const pace=dt/df;
        if(pace>=20&&pace<=7200)paceSeconds=paceSeconds===null?pace:paceSeconds*.7+pace*.3;
      }
    } else paceSeconds=null;
    runs.push({...point,runId:point.runId,leg:match.leg,fraction:match.fraction,paceSeconds,stationary:!!prior&&point.observedAt>prior.observedAt&&distance([point.lat,point.lon],[prior.lat,prior.lon])<10});
  }
  return {receivedAt:receipt,runs:runs.slice(0,10),profiles,pending:pending.slice(-128),learned:learned.slice(-128)};
}
export function learningArrivals(state: LearningState | undefined, history: TimingProfiles, plans: DeparturePlans, now: number, selectedVehicleKey?: string): StopEta[] {
  if(!state||!Number.isSafeInteger(state.receivedAt)||state.receivedAt>now||now-state.receivedAt>=90_000||!Array.isArray(state.runs)||state.runs.length>10)return [];
  const results: StopEta[]=[];
  for(const [index,run] of state.runs.entries()) {
    if(selectedVehicleKey!==undefined&&run.vehicleKey!==selectedVehicleKey||!plans[run.routeId]||
      ![1,2,3].includes(run.routeId)||![1,2].includes(run.status)||run.routeId===1&&run.status!==2||
      !directionLegs(run.routeId,run.status).includes(run.leg)||
      !Number.isSafeInteger(run.measuredAt)||!Number.isSafeInteger(run.observedAt)||run.measuredAt>run.observedAt||run.observedAt>now||
      now-run.measuredAt>=90_000||etaServiceDate(run.measuredAt)!==etaServiceDate(now)||
      !Number.isInteger(run.leg)||!finite(run.fraction)||run.fraction<0||run.fraction>1||
      state.runs.some((other,n)=>n!==index&&(other.vehicleKey===run.vehicleKey||other.runId===run.runId)))continue;
    const route=routes[run.routeId],visits=serviceVisits[route];
    if(run.leg<0||run.leg>=visits.length-1)continue;
    let arrival=run.measuredAt;
    // The published times are origin departures, never segment travel times or headways.
    if(run.leg===0&&run.fraction<.03&&run.stationary) {
      const planned=plans[run.routeId]?.find(t=>t>=run.measuredAt);
      if(planned)arrival=Math.max(arrival,planned);
    }
    for(let leg=run.leg;leg<visits.length-1;leg++) {
      const estimate=legTime(visits[leg].id,roadSeconds[route][leg],run.pattern,arrival,state.profiles,history);
      const pace=leg===run.leg&&finite(run.paceSeconds)?Math.max(estimate.seconds*.5,Math.min(estimate.seconds*3,run.paceSeconds)):estimate.seconds;
      const seconds=leg===run.leg?(estimate.seconds*.65+pace*.35)*(1-run.fraction):estimate.seconds;
      if(leg>run.leg)arrival+=legTime(`${visits[leg].id}:dwell`,30,run.pattern,arrival,state.profiles,history).seconds*1000;
      arrival+=seconds*1000;
      if(arrival<=now||arrival-run.measuredAt>20*60_000||etaServiceDate(arrival)!==etaServiceDate(now))continue;
      results.push({visitId:visits[leg+1].id,arrivalAt:Math.round(arrival),measuredAt:run.measuredAt,validUntil:run.measuredAt+90_000,basis:estimate.basis,measurementSource:run.measurementSource});
    }
  }
  return results.sort((a,b)=>a.arrivalAt-b.arrivalAt);
}
