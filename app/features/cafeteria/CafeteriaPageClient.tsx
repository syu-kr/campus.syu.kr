"use client";

import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { AnswerSummarySection } from "@/app/components/AnswerSummarySection";
import { Button } from "@/app/components/Button";
import { Container } from "@/app/components/Container";
import { CrawlDataStatus } from "@/app/components/CrawlDataStatus";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
import { StudentRestaurantMenu } from "@/app/features/cafeteria/StudentRestaurantMenu";
import {
  CafeteriaClosedCard,
  CafeteriaInfoCards,
  CafeteriaNoticeCards,
  TodayMenuCard,
  WeeklyMenuCard,
} from "@/app/features/cafeteria/CafeteriaMenuCards";
import { fetchCafeteriaSnapshot } from "@/lib/api";
import { createCafeteriaAnswerSummary } from "@/lib/campus-aeo";
import {
  getCafeteriaWeekMenus,
  isCafeteriaClosedDay,
  isCafeteriaMenuDataStale,
  type CafeteriaSnapshot,
} from "@/lib/cafeteria";
import { getKoreaNow, getTodayInfo } from "@/lib/home";

interface CafeteriaPageClientProps {
  initialSnapshot: CafeteriaSnapshot;
  initialNowIso: string;
  nonce?: string;
}

export function CafeteriaPageClient({
  initialSnapshot,
  initialNowIso,
  nonce,
}: CafeteriaPageClientProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const text = dictionary.pages.cafeteria;
  const [activeRestaurant, setActiveRestaurant] = useState<"su-lounge" | "manna">("su-lounge");
  const [now, setNow] = useState(() => new Date(initialNowIso));

  const { data: snapshot, isLoading, isError, refetch } = useQuery({
    queryKey: ["cafeteria-weekly-snapshot"],
    queryFn: fetchCafeteriaSnapshot,
    initialData: initialSnapshot,
    enabled: activeRestaurant === "su-lounge",
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
  const menus = snapshot.menus;

  useEffect(() => {
    setNow(getKoreaNow());
    const timer = setInterval(() => setNow(getKoreaNow()), 60 * 1000);
    return () => clearInterval(timer);
  }, [snapshot]);

  const todayInfo = useMemo(() => getTodayInfo(now), [now]);
  const weeklyMenus = useMemo(
    () => getCafeteriaWeekMenus(menus, todayInfo.dateStringDash),
    [menus, todayInfo.dateStringDash],
  );
  const hasOtherWeekMenus = menus.length > 0 && weeklyMenus.length === 0;
  const hasStaleWeeklyMenuData = snapshot.stale || isError || hasOtherWeekMenus;
  const hasStaleMenuData = hasStaleWeeklyMenuData || isCafeteriaMenuDataStale(menus, todayInfo.dateStringDash);
  const todayMenu = !hasStaleMenuData && !todayInfo.isWeekend
    ? weeklyMenus.find((menu) => menu.date === todayInfo.dateStringDash)
    : undefined;

  return (
    <>
      <Container className="py-3 sm:py-4 bg-white border-b border-neutral-200 md:sticky md:top-[73px] md:z-30">
        <div className="flex gap-2" role="group" aria-label={text.restaurantPicker}>
          {([
            ["su-lounge", text.suLoungeTitle],
            ["manna", text.mannaTab],
          ] as const).map(([restaurant, label]) => (
            <button
              key={restaurant}
              type="button"
              aria-pressed={activeRestaurant === restaurant}
              aria-controls="cafeteria-panel"
              onClick={() => setActiveRestaurant(restaurant)}
              className={clsx(
                "flex-1 px-3 sm:px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2",
                activeRestaurant === restaurant
                  ? "bg-blue-600 text-white shadow-md"
                  : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </Container>

      <Container className="py-6 sm:py-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">{text.title}</h1>
          <p className="text-neutral-600">{text.description}</p>
        </div>

        <div id="cafeteria-panel" role="region" aria-label={activeRestaurant === "su-lounge" ? text.suLoungeTitle : text.mannaTab}>
          {activeRestaurant === "manna" ? (
            <StudentRestaurantMenu today={todayInfo.dateStringDash} />
          ) : (
            <>
              <section id="today-menu" className="scroll-mt-24 md:scroll-mt-40">
                {(!todayMenu || isCafeteriaClosedDay(todayMenu)) && (
                  <h2 className="mb-4 text-xl font-bold text-neutral-900">{text.todayMenu}</h2>
                )}
                <CrawlDataStatus fileNames={["cafeteria-menu.json"]} />
                {isLoading && <Skeleton count={1} height="200px" />}
                {isError && (
                  <StateCard
                    type="error"
                    className="mb-8"
                    title={dictionary.home.dashboard.loadFailedTitle}
                    message={dictionary.home.dashboard.loadFailedMessage}
                    action={<Button type="button" onClick={() => refetch()}>{dictionary.home.dashboard.retry}</Button>}
                  />
                )}
                {!isLoading && !todayMenu && todayInfo.isWeekend && (
                  <StateCard type="info" className="mb-8" message={text.weekendMessage} />
                )}
                {!isLoading && hasStaleMenuData && !todayInfo.isWeekend && (
                  <StateCard type="warning" className="mb-8" title={text.staleMenuTitle} message={text.staleMenuMessage} />
                )}
                {!isLoading && !isError && !todayMenu && !todayInfo.isWeekend && !hasStaleMenuData && (
                  <StateCard
                    type="warning"
                    className="mb-8"
                    title={todayInfo.dayOfWeek === 1 ? text.pendingTitle : undefined}
                    message={todayInfo.dayOfWeek === 1 ? text.pendingMessage : text.missingToday}
                  />
                )}
                {!isLoading && todayMenu && isCafeteriaClosedDay(todayMenu) && (
                  <CafeteriaClosedCard className="mb-8" title={text.closedTodayTitle} message={text.closedTodayMessage} />
                )}
                {!isLoading && todayMenu && !isCafeteriaClosedDay(todayMenu) && <TodayMenuCard menu={todayMenu} />}
              </section>

              <AnswerSummarySection
                summary={createCafeteriaAnswerSummary({
                  locale,
                  menus,
                  now,
                  todayInfo,
                  stale: hasStaleMenuData,
                })}
                sources={[{
                  name: text.answer.source,
                  url: "https://www.syu.ac.kr/school-life/facility-information/cafeteria/",
                  checkedAt: snapshot.checkedAt,
                }]}
                schemaId="cafeteria-answer-schema"
                path="/campus/cafeteria"
                basisAt={now.toISOString()}
                nonce={nonce}
              />

              <CafeteriaInfoCards />

              <section className="mb-8" aria-labelledby="su-lounge-weekly-heading">
                <h2 id="su-lounge-weekly-heading" className="mb-4 text-lg font-bold text-neutral-900">{text.weeklyMenu}</h2>
                <div className="space-y-6">
                  {isLoading && <Skeleton count={3} height="200px" />}
                  {!isLoading && hasStaleWeeklyMenuData && (
                    <StateCard type="warning" title={text.staleMenuTitle} message={text.staleMenuMessage} />
                  )}
                  {!isLoading && !hasStaleWeeklyMenuData && weeklyMenus.length === 0 && (
                    <StateCard type="info" message={text.emptyWeekly} />
                  )}
                  {!isLoading && !hasStaleWeeklyMenuData && weeklyMenus.map((menu) => (
                    <WeeklyMenuCard key={menu.id} menu={menu} isToday={menu.date === todayInfo.dateStringDash && !todayInfo.isWeekend} />
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
        <CafeteriaNoticeCards />
      </Container>
    </>
  );
}
