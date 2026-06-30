"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Container } from "@/app/components/Container";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
import {
  CafeteriaInfoCards,
  CafeteriaNoticeCards,
  TodayMenuCard,
  WeeklyMenuCard,
} from "@/app/features/cafeteria/CafeteriaMenuCards";
import { useDictionary } from "@/app/components/LocaleProvider";
import { fetchCafeteriaMenu } from "@/lib/api";
import { isCafeteriaClosedDay } from "@/lib/cafeteria";
import { getKoreaNow, getTodayInfo } from "@/lib/home";
import type { CafeteriaMenu } from "@/types";

interface CafeteriaPageClientProps {
  initialMenus: CafeteriaMenu[];
  initialNowIso: string;
}

export function CafeteriaPageClient({
  initialMenus,
  initialNowIso,
}: CafeteriaPageClientProps) {
  const dictionary = useDictionary();
  const text = dictionary.pages.cafeteria;
  const [now, setNow] = useState<Date | null>(() => new Date(initialNowIso));

  useEffect(() => {
    setNow(getKoreaNow());

    const timer = setInterval(() => {
      setNow(getKoreaNow());
    }, 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const { data: menus, isLoading } = useQuery({
    queryKey: ["cafeteria-weekly"],
    queryFn: () => fetchCafeteriaMenu(),
    initialData: initialMenus,
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const todayInfo = useMemo(() => getTodayInfo(now), [now]);

  const todayMenu = useMemo(() => {
    if (!menus || todayInfo.isWeekend) return null;
    return menus.find((menu) => menu.date === todayInfo.dateStringDash) ?? null;
  }, [menus, todayInfo.dateStringDash, todayInfo.isWeekend]);

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          {text.title}
        </h1>
        <p className="text-neutral-600">{text.description}</p>
      </div>

      {!isLoading && !todayMenu && todayInfo.isWeekend && (
        <StateCard
          type="info"
          className="mb-8"
          message={text.weekendMessage}
        />
      )}

      {!isLoading &&
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
        <StateCard
          type="info"
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

          {!isLoading && (!menus || menus.length === 0) && (
            <StateCard type="info" message={text.emptyWeekly} />
          )}

          {!isLoading &&
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
