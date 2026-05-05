"use client";

import { Container } from "@/app/components/Container";
import { Skeleton } from "@/app/components/Skeleton";
import { StateCard } from "@/app/components/StateCard";
import {
  CafeteriaInfoCards,
  TodayMenuCard,
  WeeklyMenuCard,
} from "@/app/features/cafeteria/CafeteriaMenuCards";
import { fetchCafeteriaMenu } from "@/lib/api";
import { isCafeteriaClosedDay } from "@/lib/cafeteria";
import { getKoreaNow } from "@/lib/home";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

export default function CafeteriaPage() {
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
          학식
        </h1>
        <p className="text-neutral-600">주간 식단 및 영양정보를 확인하세요</p>
      </div>

      <CafeteriaInfoCards />

      {!isLoading && !todayMenu && todayInfo.isWeekend && (
        <StateCard
          type="info"
          className="mb-8"
          message="오늘은 주말입니다. 주말 식단 정보는 제공되지 않을 수 있습니다."
        />
      )}

      {!isLoading &&
        !todayMenu &&
        !todayInfo.isWeekend &&
        todayInfo.dayOfWeek === 1 && (
          <StateCard
            type="warning"
            className="mb-8"
            title="식단 준비 중입니다"
            message="월요일 식단 데이터가 아직 준비 중입니다. 잠시 후 다시 확인해주세요."
          />
        )}

      {!isLoading &&
        !todayMenu &&
        !todayInfo.isWeekend &&
        todayInfo.dayOfWeek !== 1 && (
          <StateCard
            type="warning"
            className="mb-8"
            message="오늘 식단 정보가 없습니다. 주간 메뉴에서 다른 날짜를 확인해주세요."
          />
        )}

      {!isLoading && todayMenu && isCafeteriaClosedDay(todayMenu) && (
        <StateCard
          type="info"
          className="mb-8"
          title="오늘은 운영하지 않습니다"
          message="공휴일 또는 운영하지 않는 날입니다. 주간 메뉴에서 다른 날짜를 확인해주세요."
        />
      )}

      {!isLoading && todayMenu && !isCafeteriaClosedDay(todayMenu) && (
        <TodayMenuCard menu={todayMenu} />
      )}

      <div className="mb-8">
        <h2 className="text-lg font-bold text-neutral-900 mb-4">주간 메뉴</h2>
        <div className="space-y-6">
          {isLoading && <Skeleton count={3} height="200px" />}

          {!isLoading && (!menus || menus.length === 0) && (
            <StateCard type="info" message="표시할 주간 식단 정보가 없습니다." />
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
    </Container>
  );
}
