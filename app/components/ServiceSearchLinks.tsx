"use client";
import Link from 'next/link';
import {useDictionary,useLocale} from '@/app/components/LocaleProvider';
import {localizePath} from '@/lib/i18n';
import {findServices} from '@/lib/service-search';
import {useRoommatesEnabled} from './RoommatesAvailability';
import {useId} from 'react';
export function ServiceSearchLinks({query,onNavigate}:{query:string;onNavigate?:()=>void}){
  const headingId=useId();
  const enabled=useRoommatesEnabled();
  const locale=useLocale(),dictionary=useDictionary(),items=findServices(query,enabled);if(!items.length)return null;
  return <section className="m3-service-results" aria-labelledby={headingId} aria-live="polite"><h2 id={headingId}>{dictionary.m3.serviceSearch}</h2><ul>{items.map(item=><li key={item.path}><Link href={localizePath(item.path,locale)} onClick={event=>{if(event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey)onNavigate?.();}}><span>{locale==='en'?item.en:item.ko}</span><span aria-hidden="true">›</span></Link></li>)}</ul></section>;
}

