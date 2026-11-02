import type { TimingProfiles } from "./shuttle-learning";
type Detection = {station:string;date:string;timeHHMM:string;vehicleAlias:string};
const stations:Record<string,string>={"화랑대역":"hwarangdae","석계역":"seokgye","태릉입구역":"taereung","별내역":"byeollae"};
function median(values:number[]) {const v=[...values].sort((a,b)=>a-b),m=Math.floor(v.length/2);return v.length%2?v[m]:(v[m-1]+v[m])/2;}
export function buildShuttleHistory(input:unknown) {
  if(!input||typeof input!=="object"||!Array.isArray((input as {rows?:unknown}).rows))throw new Error("Invalid history dataset");
  const raw=(input as {rows:unknown[]}).rows;
  if(!raw.length||raw.length>100000)throw new Error("Invalid history size");
  const rows:Detection[]=raw.map(value=>{
    if(!value||typeof value!=="object")throw new Error("Invalid history row");
    const r=value as Detection;
    if(!stations[r.station]||typeof r.date!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(r.date)||
      new Date(`${r.date}T00:00:00Z`).toISOString().slice(0,10)!==r.date||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.timeHHMM)||
      typeof r.vehicleAlias!=="string"||!r.vehicleAlias||r.vehicleAlias.length>128)throw new Error("Invalid history fields");
    return {station:r.station,date:r.date,timeHHMM:r.timeHHMM,vehicleAlias:r.vehicleAlias};
  });
  const aliases=new Map([...new Set(rows.map(r=>r.vehicleAlias))].sort().map((id,i)=>[id,i+1]));
  const groups=new Map<string,Detection[]>();
  for(const row of rows){const key=`${row.date}:${row.vehicleAlias}`,list=groups.get(key)??[];list.push(row);groups.set(key,list);}
  const pairs:{seconds:number;at:number;key:string}[]=[];
  for(const list of groups.values()) {
    const ordered=[...list].sort((a,b)=>a.timeHHMM.localeCompare(b.timeHHMM));
    for(let i=0;i<ordered.length-1;i++) {
      const a=ordered[i],b=ordered[i+1],start=Date.parse(`${a.date}T${a.timeHHMM}:00+09:00`),end=Date.parse(`${b.date}T${b.timeHHMM}:00+09:00`);
      if(a.station!=="석계역"||b.station!=="태릉입구역"||end<=start||end-start>7200000)continue;
      const date=new Date(start+9*3600000),weekday=date.getUTCDay();if(weekday===0||weekday===6)continue;
      pairs.push({seconds:(end-start)/1000,at:start,key:`history:${weekday}:${date.getUTCHours()*2+Math.floor(date.getUTCMinutes()/30)}`});
    }
  }
  const cells:Record<string,{seconds:number;n:number;at:number}>={};
  for(const key of new Set(pairs.map(p=>p.key))) {const group=pairs.filter(p=>p.key===key);cells[key]={seconds:median(group.map(p=>p.seconds)),n:group.length,at:Math.max(...group.map(p=>p.at))};}
  const profiles:TimingProfiles=pairs.length?{"seokgye-4":{seconds:median(pairs.map(p=>p.seconds)),n:pairs.length,cells}}:{};
  return {profiles,events:rows.map(r=>({station:stations[r.station],date:r.date,time:r.timeHHMM,vehicle:aliases.get(r.vehicleAlias)!})),
    summary:{detections:rows.length,linkedPairs:pairs.length,dates:new Set(rows.map(r=>r.date)).size,from:rows.map(r=>r.date).sort()[0],through:rows.map(r=>r.date).sort().at(-1)!,
      byStation:Object.fromEntries(Object.entries(stations).map(([ko,id])=>[id,rows.filter(r=>r.station===ko).length])),precisionSeconds:60,identityVerified:false}};
}
