"use client";
import Link from 'next/link';
import {useDictionary,useLocale} from '@/app/components/LocaleProvider';
import {localizePath} from '@/lib/i18n';
import {findServices} from '@/lib/service-search';
import {useRoommatesEnabled} from './RoommatesAvailability';
export function ServiceSearchLinks({query}:{query:string}){
  const enabled=useRoommatesEnabled();
  const locale=useLocale(),dictionary=useDictionary(),items=findServices(query,enabled);if(!items.length)return null;
  return <section className="m3-service-results" aria-labelledby="m3-service-search-title"><h2 id="m3-service-search-title">{dictionary.m3.serviceSearch}</h2><ul>{items.map(item=><li key={item.path}><Link href={localizePath(item.path,locale)}><span>{locale==='en'?item.en:item.ko}</span><span aria-hidden="true">›</span></Link></li>)}</ul></section>;
}

