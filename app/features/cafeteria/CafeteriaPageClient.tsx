"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Container } from "@/app/components/Container";
import { CrawlDataStatus } from "@/app/components/CrawlDataStatus";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
import { Button } from "@/app/components/Button";
import { AnswerSummarySection } from "@/app/components/AnswerSummarySection";
import {
  CafeteriaClosedCard,
  CafeteriaInfoCards,
  CafeteriaNoticeCards,
  TodayMenuCard,
  WeeklyMenuCard,
} from "@/app/features/cafeteria/CafeteriaMenuCards";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import { fetchCafeteriaSnapshot } from "@/lib/api";
import { createCafeteriaAnswerSummary } from "@/lib/campus-aeo";
import {
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
  const [now, setNow] = useState(() => new Date(initialNowIso));

  const { data: snapshot, isLoading, isError, refetch } = useQuery({
    queryKey: ["cafeteria-weekly-snapshot"],
    queryFn: fetchCafeteriaSnapshot,
    initialData: initialSnapshot,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });
  const menus = snapshot.menus;

  useEffect(() => {
    setNow(getKoreaNow());

    const timer = setInterval(() => {
      setNow(getKoreaNow());
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, [snapshot]);

  const todayInfo = useMemo(() => getTodayInfo(now), [now]);
  const hasStaleMenuData = useMemo(
    () => snapshot.stale || isError || isCafeteriaMenuDataStale(menus, todayInfo.dateStringDash),
    [isError, snapshot.stale, menus, todayInfo.dateStringDash],
  );
  const shouldShowStaleToday =
    hasStaleMenuData && !todayInfo.isWeekend;

  const todayMenu = useMemo(() => {
    if (!menus || todayInfo.isWeekend || hasStaleMenuData) return null;
    return menus.find((menu) => menu.date === todayInfo.dateStringDash) ?? null;
  }, [
    hasStaleMenuData,
    menus,
    todayInfo.dateStringDash,
    todayInfo.isWeekend,
  ]);

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          {text.title}
        </h1>
        <p className="text-neutral-600">{text.description}</p>
      </div>

      <CrawlDataStatus fileNames={["cafeteria-menu.json"]} />

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

      {isError && (
        <StateCard
          type="error"
          className="mb-8"
          title={dictionary.home.dashboard.loadFailedTitle}
          message={dictionary.home.dashboard.loadFailedMessage}
          action={
            <Button
              type="button"
              onClick={() => refetch()}
            >
              {dictionary.home.dashboard.retry}
            </Button>
          }
        />
      )}

      {!isLoading && !todayMenu && todayInfo.isWeekend && (
        <StateCard
          type="info"
          className="mb-8"
          message={text.weekendMessage}
        />
      )}

      {!isLoading && shouldShowStaleToday && (
        <StateCard
          type="warning"
          className="mb-8"
          title={text.staleMenuTitle}
          message={text.staleMenuMessage}
        />
      )}

      {!isLoading &&
        !shouldShowStaleToday &&
        !isError &&
        !todayMenu &&
        !todayInfo.isWeekend &&
        todayInfo.dayOfWeek === 1 && (
          <StateCard
            type="warning"
            className="mb-8"
            title={text.pendingTitle}
            message={text.pendingMessage}
          />
        )}

      {!isLoading &&
        !shouldShowStaleToday &&
        !isError &&
        !todayMenu &&
        !todayInfo.isWeekend &&
        todayInfo.dayOfWeek !== 1 && (
          <StateCard
            type="warning"
            className="mb-8"
            message={text.missingToday}
          />
        )}

      {!isLoading && todayMenu && isCafeteriaClosedDay(todayMenu) && (
        <CafeteriaClosedCard
          className="mb-8"
          title={text.closedTodayTitle}
          message={text.closedTodayMessage}
        />
      )}

      {!isLoading && todayMenu && !isCafeteriaClosedDay(todayMenu) && (
        <TodayMenuCard menu={todayMenu} />
      )}

      <CafeteriaInfoCards />

      <div className="mb-8">
        <h2 className="text-lg font-bold text-neutral-900 mb-4">
          {text.weeklyMenu}
        </h2>
        <div className="space-y-6">
          {isLoading && <Skeleton count={3} height="200px" />}

          {!isLoading && hasStaleMenuData && (
            <StateCard
              type="warning"
              title={text.staleMenuTitle}
              message={text.staleMenuMessage}
            />
          )}

          {!isLoading &&
            !isError &&
            !hasStaleMenuData &&
            (!menus || menus.length === 0) && (
            <StateCard type="info" message={text.emptyWeekly} />
          )}

          {!isLoading &&
            !hasStaleMenuData &&
            menus &&
            menus.length > 0 &&
            menus.map((menu) => (
              <WeeklyMenuCard
                key={menu.id}
                menu={menu}
                isToday={
                  menu.date === todayInfo.dateStringDash &&
                  !todayInfo.isWeekend
                }
              />
            ))}
        </div>
      </div>

      <CafeteriaNoticeCards />
    </Container>
  );
}
