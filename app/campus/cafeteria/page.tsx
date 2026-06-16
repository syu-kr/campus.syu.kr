"use client";

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
import { getKoreaNow } from "@/lib/home";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

export default function CafeteriaPage() {
  const dictionary = useDictionary();
  const text = dictionary.pages.cafeteria;
  const [now, setNow] = useState<Date | null>(null);

  // 날짜 기반 표시만 사용하므로 분 단위로 갱신합니다.
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
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  const todayInfo = useMemo(() => {
    if (!now) return { dateString: "", isWeekend: false, dayOfWeek: -1 };

    const dayOfWeek = now.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const date = String(now.getDate()).padStart(2, "0");

    return {
      dateString: `${year}-${month}-${date}`,
      isWeekend,
      dayOfWeek,
    };
  }, [now]);

  const todayMenu = useMemo(() => {
    if (!menus) return null;
    return menus.find(
      (menu) => menu.date === todayInfo.dateString && !todayInfo.isWeekend,
    );
  }, [menus, todayInfo.dateString, todayInfo.isWeekend]);

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
                  menu.date === todayInfo.dateString && !todayInfo.isWeekend
                }
              />
            ))}
        </div>
      </div>

      <CafeteriaNoticeCards />
    </Container>
  );
}
