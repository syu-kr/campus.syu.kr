"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import { Icon } from "@/app/components/Icon";
import { M3Select } from "@/app/components/M3Select";
import { localizePath } from "@/lib/i18n";
import { getSemesterEndCountdown, getTodayInfo } from "@/lib/home";
import { getCafeteriaWeekMenus, isCafeteriaMenuDataStale, isCafeteriaClosedDay, isClosedMealItems, type CafeteriaSnapshot } from "@/lib/cafeteria";
import { getCurrentShuttleSummary } from "@/lib/shuttle-schedule";
import { fetchCafeteriaSnapshot, fetchShuttleBuses, fetchShuttleSpecialPeriods, fetchPublicHolidays } from "@/lib/api";
import { fetchJson } from "@/lib/fetch-json";
import { readSessionValue, writeSessionValue } from "@/lib/browser-storage";
import { useStudentRestaurantMenu } from "@/app/features/cafeteria/useStudentRestaurantMenu";
import type { AcademicSchedule, BusArrivalsAtStop, PublicHolidaySnapshot, ShuttleBusSchedule, ShuttleSpecialPeriods } from "@/types";
import type { LiveDataResponse } from "@/types/live-data";
import { HomeWeatherLine } from "./HomeWeatherLine";
import { PublicContentTranslation } from "@/app/components/ContentTranslation";
import { getPublicContentAlias } from "@/lib/public-content-aliases";

const FIVE_MINUTES = 5 * 60 * 1000;
const THIRTY_MINUTES = 30 * 60 * 1000;
const BUS_PREVIEW_MINUTES = 60;
const RESTAURANTS = ["su-lounge", "manna"] as const;
const TRANSPORTS = ["shuttle", "transit"] as const;
const STOPS = [
  ["jungmun-up", "jungmunUp"],
  ["jungmun-down", "jungmunDown"],
  ["humun-up", "humunUp"],
  ["humun-down", "humunDown"],
] as const;
const STOP_IDS = STOPS.map(([id]) => id);
type StopId = (typeof STOPS)[number][0];

export interface HomeOverviewData {
  firebaseDataEnabled?: boolean;
  cafeteria?: CafeteriaSnapshot;
  shuttles?: ShuttleBusSchedule[];
  specialPeriods?: ShuttleSpecialPeriods;
  holidays?: PublicHolidaySnapshot;
  updatedAt: number;
}

function useHomeChoice<T extends string>(key: string, fallback: T, allowed: readonly T[]) {
  const [value, setValue] = useState<T>(fallback);
  useEffect(() => {
    const stored = readSessionValue(key) as T | null;
    if (stored && allowed.includes(stored)) setValue(stored);
  }, [key, allowed]);
  return [value, (next: T) => {
    if (!allowed.includes(next)) return;
    setValue(next);
    writeSessionValue(key, next);
  }] as const;
}

function hasRetryableFailure(query: {
  isError: boolean; isFetching: boolean; errorUpdatedAt: number; dataUpdatedAt: number;
}) {
  return query.isError || (query.isFetching && query.errorUpdatedAt > query.dataUpdatedAt);
}

function Status({ state, onRefresh, onRetry, busy }: {
  state: "fresh" | "loading" | "error" | "stale" | "unavailable";
  onRefresh?: () => void;
  onRetry?: () => void;
  busy: boolean;
}) {
  const dictionary = useDictionary(), text = dictionary.home.overview;
  const action = onRetry ?? onRefresh;
  if (state === "fresh" && !action) return null;
  return <div className="m3-home-status">
    {state !== "fresh" && <span data-state={state} role="status">{text.status[state]}</span>}
    {action && <button type="button" className="ml-auto" onClick={action} disabled={busy}>
      {onRetry ? dictionary.home.dashboard.retry : text.refresh}
    </button>}
  </div>;
}

function SuMeal({ now, initial }: { now: Date | null; initial: HomeOverviewData }) {
  const dictionary = useDictionary(), text = dictionary.pages.cafeteria, overview = dictionary.home.overview;
  const today = getTodayInfo(now);
  const food = useQuery({
    queryKey: ["cafeteria-weekly-snapshot"], queryFn: fetchCafeteriaSnapshot,
    initialData: initial.cafeteria, initialDataUpdatedAt: initial.updatedAt,
    staleTime: THIRTY_MINUTES, gcTime: 60 * 60 * 1000, retry: false,
  });
  const menus = food.data?.menus ?? [];
  const weekly = getCafeteriaWeekMenus(menus, today.dateStringDash);
  const stale = Boolean(food.data?.stale || food.isError ||
    (menus.length > 0 && weekly.length === 0) || isCafeteriaMenuDataStale(menus, today.dateStringDash));
  const meal = !stale && !today.isWeekend ? weekly.find((item) => item.date === today.dateStringDash) : undefined;
  const corner = meal && isClosedMealItems(meal.lunch.a) ? "b" : "a";
  const lunch = meal?.lunch[corner];
  const message = today.isWeekend ? text.weekendMessage : food.isPending ? overview.mealLoading : food.isError ? overview.mealError :
    stale ? text.staleMenuTitle :
      !meal ? (today.dayOfWeek === 1 ? text.pendingTitle : text.missingToday) :
        isCafeteriaClosedDay(meal) ? text.closedTodayTitle : isClosedMealItems(lunch) ? overview.lunchClosed : null;
  return <>
    <p className="m3-home-context">{text.suLoungeTitle} · {overview.lunchCorner.replace("{corner}", corner.toUpperCase())}</p>
    {message ? <p className="m3-home-empty">{message}</p> : <>
      {meal && <PublicContentTranslation source={{ kind: "cafeteria", id: meal.id }}
        content={Object.fromEntries((lunch ?? []).map((item, index) => [`lunch.${corner}.${index}`, item.name]))}>{translation => <>
          <strong lang={translation.lang} className="m3-home-food">{translation.text(`lunch.${corner}.0`, lunch?.[0]?.name ?? "")}</strong>
          <p lang={translation.lang} className="m3-home-sides">{lunch?.slice(1).map((item, index) => translation.text(`lunch.${corner}.${index + 1}`, item.name)).join(" · ")}</p>
        </>}</PublicContentTranslation>}
    </>}
    {!today.isWeekend && <Status state={food.isPending || food.isFetching ? "loading" : food.isError ? "error" : stale ? "stale" : "fresh"}
      busy={food.isFetching} onRetry={hasRetryableFailure(food) ? () => void food.refetch() : undefined} />}
  </>;
}

function MannaMeal({ today, isWeekend, firebaseDataEnabled }: { today: string; isWeekend: boolean; firebaseDataEnabled?: boolean }) {
  const dictionary = useDictionary(), text = dictionary.pages.cafeteria, overview = dictionary.home.overview;
  const query = useStudentRestaurantMenu(firebaseDataEnabled);
  const day = query.data?.days.find((item) => item.date === today), lunch = day?.lunch;
  const missingDay = Boolean(query.data && !day);
  const message = isWeekend ? text.weekendMessage : !query.isConfigured ? text.studentRestaurant.notConfigured :
    query.isPending ? overview.mealLoading : query.isError ? text.studentRestaurant.errorTitle :
      !day ? text.missingToday : lunch === null ? text.studentRestaurant.unknownMeal :
        !lunch?.length ? text.closedMeal : null;
  return <>
    <p className="m3-home-context">{overview.mannaLunch}</p>
    {message ? <p className="m3-home-empty">{message}</p> : <>
      {day && <PublicContentTranslation source={{ kind: "student-restaurant", id: day.date }}
        content={Object.fromEntries((lunch ?? []).map((item, index) => [`lunch.${index}`, item]))}>{translation => <>
          <strong lang={translation.lang} className="m3-home-food">{translation.text("lunch.0", lunch?.[0] ?? "")}</strong>
          <p lang={translation.lang} className="m3-home-sides">{lunch?.slice(1).map((item, index) => translation.text(`lunch.${index + 1}`, item)).join(" · ")}</p>
        </>}</PublicContentTranslation>}
    </>}
    {!isWeekend && <Status state={!query.isConfigured ? "unavailable" : query.isPending || query.isFetching ? "loading" :
      query.isError ? "error" : missingDay || lunch === null ? "stale" : "fresh"}
      busy={query.isFetching} onRetry={query.isConfigured && hasRetryableFailure(query) ? () => void query.refetch() : undefined} />}
  </>;
}

function ShuttleSummary({ now, initial }: { now: Date | null; initial: HomeOverviewData }) {
  const text = useDictionary().home.overview;
  const locale = useLocale();
  const buses = useQuery({
    queryKey: ["shuttle-buses"], queryFn: fetchShuttleBuses,
    initialData: initial.shuttles, initialDataUpdatedAt: initial.updatedAt,
    staleTime: FIVE_MINUTES, gcTime: THIRTY_MINUTES, retry: false,
  });
  const special = useQuery({
    queryKey: ["shuttle-special-periods"], queryFn: fetchShuttleSpecialPeriods,
    initialData: initial.specialPeriods, initialDataUpdatedAt: initial.updatedAt,
    staleTime: FIVE_MINUTES, gcTime: THIRTY_MINUTES, retry: false,
  });
  const holidays = useQuery({
    queryKey: ["public-holidays"], queryFn: fetchPublicHolidays,
    initialData: initial.holidays, initialDataUpdatedAt: initial.updatedAt,
    staleTime: FIVE_MINUTES, refetchInterval: FIVE_MINUTES, retry: false,
  });
  const error = buses.isError || special.isError || holidays.isError;
  const loading = buses.isPending || special.isPending || holidays.isPending;
  const busy = buses.isFetching || special.isFetching || holidays.isFetching;
  const summary = getCurrentShuttleSummary({
    buses: buses.data ?? [], specialPeriods: special.data,
    holidays: holidays.data && { ...holidays.data, stale: holidays.data.stale || holidays.isError },
    now, limit: buses.data?.length || 2,
  });
  const departures = summary.departures.filter(item => item.minutesUntil <= BUS_PREVIEW_MINUTES);
  const departure = departures[0];
  const showRouteList = summary.operationStatus === "regular" && summary.isOperatingPeriod &&
    summary.additionalServicePeriods.length === 0 && Boolean(buses.data?.length);
  return <>
    {loading ? <p className="m3-home-empty">{text.status.loading}</p> :
      error ? <p className="m3-home-empty">{text.serviceError}</p> :
        showRouteList ? <ul className="m3-home-shuttle-list" aria-label={text.shuttleDepartures}>
          {buses.data?.map((bus) => {
            const next = departures.find((item) => item.routeName === bus.routeName);
            return <li key={bus.id} className="m3-home-shuttle-row">
              <div>
                <PublicContentTranslation source={{ kind: "shuttle", id: bus.id }} content={getPublicContentAlias(bus.routeName, locale) === bus.routeName ? { routeName: bus.routeName } : {}}>{translation => <strong lang={getPublicContentAlias(bus.routeName, locale) === bus.routeName ? translation.lang : locale} title={bus.routeName} className="m3-home-shuttle-name">{translation.text("routeName", getPublicContentAlias(bus.routeName, locale))}</strong>}</PublicContentTranslation>
                <p className="m3-home-shuttle-support">{next
                  ? text.shuttleDepartureAt.replace("{time}", next.time)
                  : text.shuttleNextNone}</p>
              </div>
              {next && <span className="m3-home-shuttle-time"><strong>{next.minutesUntil}</strong><span>{text.shuttleMinutes}</span></span>}
            </li>;
          })}
        </ul> : departure ? <>
          <p title={departure.routeName} className="m3-home-context">{getPublicContentAlias(departure.routeName, locale)}</p>
          <div className="m3-home-countdown"><strong>{departure.minutesUntil}</strong><span>{text.minutesUntilDeparture}</span></div>
          <p className="m3-home-sides">{departure.time} {text.departure}</p>
        </> : <p className="m3-home-empty">{summary.additionalServicePeriods.length ? text.specialService :
          summary.operationStatus === "unconfirmed" ? text.serviceUnconfirmed :
            summary.operationStatus === "closed" ? text.serviceClosed : text.noMoreDepartures}</p>}
    {summary.isSpecialSchedule && !error && !loading && <p className="m3-home-sides">{text.specialTimetable}</p>}
    <Status state={loading || busy ? "loading" : error ? "error" : summary.operationStatus === "unconfirmed" ? "stale" : "fresh"}
      busy={busy} onRetry={[buses, special, holidays].some(hasRetryableFailure) ? () => { void buses.refetch(); void special.refetch(); void holidays.refetch(); } : undefined} />
  </>;
}

type SerializedStop = Omit<BusArrivalsAtStop, "lastUpdated"> & { lastUpdated: string };
function TransitSummary({ stop, onStop }: { stop: StopId; onStop: (value: StopId) => void }) {
  const locale = useLocale(), dictionary = useDictionary(), text = dictionary.pages.busInfo, overview = dictionary.home.overview;
  const query = useQuery({
    queryKey: ["public-transit-arrivals", locale],
    queryFn: async ({ signal }) => {
      const json = await fetchJson<LiveDataResponse<SerializedStop[]>>("/api/bus/public-transit", {
        fallback: { success: false, source: "public-transit-arrivals", data: [], timestamp: "", stale: false, sourceStatus: "error" },
        throwOnError: true, signal,
      });
      if (!json.success) throw new Error(json.error || text.transitLoadFailed);
      return { ...json, data: json.data.map((item) => ({ ...item, lastUpdated: new Date(item.lastUpdated) })) };
    },
    staleTime: 10_000, gcTime: 60_000, refetchInterval: 10_000, refetchIntervalInBackground: false,
  });
  const [area, direction] = stop.split("-");
  const selected = query.data?.data.find((item) => item.stop.id.includes(area) && item.stop.direction === direction);
  const arrivals = (selected?.arrivals ?? []).filter((item) => typeof item.predictTime1 === "number" &&
    item.predictTime1 > 0 && item.predictTime1 <= BUS_PREVIEW_MINUTES)
    .sort((a, b) => (a.predictTime1 ?? Infinity) - (b.predictTime1 ?? Infinity));
  const stale = query.data?.stale || query.data?.sourceStatus === "error";
  return <>
    <div className="m3-home-stop">
      <label id="home-transit-stop-label" htmlFor="home-transit-stop">{overview.busStop}</label>
      <M3Select id="home-transit-stop" value={stop} variant="tonal" leadingIcon={<Icon name="map-pin" size={20} />}
        options={STOPS.map(([value, key]) => ({ value, label: text.stopLabels[key] }))}
        onValueChange={(value) => {
          const next = STOP_IDS.find((id) => id === value);
          if (next) onStop(next);
        }} />
    </div>
    {query.isPending ? <p className="m3-home-empty">{overview.status.loading}</p> :
      query.isError ? <p className="m3-home-empty">{text.transitLoadFailed}</p> :
        arrivals[0] ? <><strong translate="no" className="m3-home-food">{arrivals[0].routeName}</strong><p className="m3-home-sides">{locale === "ko" ? arrivals[0].arrivalMsg1 : `${Math.ceil(arrivals[0].predictTime1 ?? 0)} ${text.minutesAfter}`}</p></> :
          <p className="m3-home-empty">{overview.noArrivals}</p>}
    <Status state={query.isPending || query.isFetching ? "loading" : query.isError ? "error" : stale ? "stale" : "fresh"}
      busy={query.isFetching} onRefresh={() => void query.refetch()} onRetry={hasRetryableFailure(query) ? () => void query.refetch() : undefined} />
  </>;
}

export function M3HomeOverview({ now, initial, children, banner, schedules = [] }: {
  now: Date | null;
  initial: HomeOverviewData;
  children: ReactNode;
  banner?: ReactNode;
  schedules?: AcademicSchedule[];
}) {
  const locale = useLocale(), dictionary = useDictionary(), text = dictionary.home.overview, today = getTodayInfo(now);
  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(locale === "en" ? "en-US" : "ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "long", timeZone: "Asia/Seoul",
  }), [locale]);
  const [restaurant, setRestaurant] = useHomeChoice("campus-m3-home-restaurant", "su-lounge", RESTAURANTS);
  const [busMode, setBusMode] = useHomeChoice("campus-m3-home-transport", "shuttle", TRANSPORTS);
  const [stop, setStop] = useHomeChoice("campus-m3-home-stop", "jungmun-up", STOP_IDS);
  const link = (path: string) => localizePath(path, locale);
  const semesterEnd = getSemesterEndCountdown(schedules, today.dateStringDash);
  return <div className="m3-home-overview">
    <header className="m3-home-intro"><div>
      <p className="m3-home-date">{now ? <time dateTime={now.toISOString()}>{dateFormatter.format(now)}</time> : ""}</p>
      <h1><HomeWeatherLine /></h1>
    </div><span className={semesterEnd ? "m3-home-academic-countdown" : undefined}>{semesterEnd ? <Link href={link("/academic/schedule")}>
      {text.semesterEndCountdown.replace("{days}", String(semesterEnd.days))}
    </Link> : text.hint}</span></header>
    {banner}
    <div className="m3-home-essentials">
      <section className="m3-home-meal">
        <header><h2><Icon name="utensils" />{text.mealTitle}</h2>
          <Link href={link("/campus/cafeteria") + (restaurant === "manna" ? "?restaurant=manna" : "")}>{text.fullMenu} <span aria-hidden="true">→</span></Link>
        </header>
        <div className="m3-home-picker m3-segmented" data-selected-index={restaurant === "manna" ? 1 : 0} role="group" aria-label={text.restaurant}>
          {RESTAURANTS.map((value) => <button type="button" key={value} aria-pressed={restaurant === value} onClick={() => setRestaurant(value)}>
            {value === "su-lounge" ? dictionary.pages.cafeteria.suLoungeTitle : dictionary.pages.cafeteria.mannaTab}
          </button>)}
        </div>
        {restaurant === "su-lounge" ? <SuMeal now={now} initial={initial} /> : <MannaMeal today={today.dateStringDash} isWeekend={today.isWeekend} firebaseDataEnabled={initial.firebaseDataEnabled} />}
      </section>
      <section className="m3-home-schedules">{children}</section>
      <section className="m3-home-bus">
        <header><h2><Icon name="bus" />{text.busTitle}</h2>
          <Link href={link("/campus/bus-info") + (busMode === "transit" ? "?tab=public-transit&stop=" + encodeURIComponent(stop) : "")}>{text.busInfo} <span aria-hidden="true">→</span></Link>
        </header>
        <div className="m3-home-picker m3-segmented" data-selected-index={busMode === "transit" ? 1 : 0} role="group" aria-label={text.transport}>
          {TRANSPORTS.map((value) => <button type="button" key={value} aria-pressed={busMode === value} onClick={() => setBusMode(value)}>
            {value === "shuttle" ? text.shuttle : text.publicTransit}
          </button>)}
        </div>
        {busMode === "shuttle" ? <ShuttleSummary now={now} initial={initial} /> : <TransitSummary stop={stop} onStop={setStop} />}
      </section>
    </div>
  </div>;
}
