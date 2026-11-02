const intervals=new WeakMap<object,{version:string;delay:number}>();
export function shuttleRefreshDelay(query?:{state:{dataUpdatedAt:number;errorUpdatedAt:number}}) {
  const version=query?`${query.state.dataUpdatedAt}:${query.state.errorUpdatedAt}`:"";
  const previous=query?intervals.get(query):undefined;
  if(previous?.version===version)return previous.delay;
  const delay=5_000+Math.floor(Math.random()*5_001);
  if(query)intervals.set(query,{version,delay});
  return delay;
}
