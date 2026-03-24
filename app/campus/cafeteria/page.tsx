"use client";

import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { Skeleton } from "@/app/components/Skeleton";
import { Icon } from "@/app/components/Icon";
import { useQuery } from "@tanstack/react-query";
import { fetchCafeteriaMenu } from "@/lib/api";
import { useMemo } from "react";

export default function CafeteriaPage() {
  const { data: menus, isLoading } = useQuery({
    queryKey: ["cafeteria-weekly"],
    queryFn: () => fetchCafeteriaMenu(),
    staleTime: 30 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
  });

  // 오늘 날짜와 요일 계산
  const todayInfo = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0: 일요일, 6: 토요일
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dateString = today.toISOString().split("T")[0]; // YYYY-MM-DD
    return { dateString, isWeekend, dayOfWeek };
  }, []);

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          학식
        </h1>
        <p className="text-neutral-600">주간 식단 및 영양정보를 확인하세요</p>
      </div>

      {/* 만나의집 알림 */}
      <Card className="mt-8 bg-yellow-50 border border-yellow-200">
        <p className="text-sm text-yellow-900">
          <strong>알림:</strong> 현재 만나의 집의 경우는 구현되어있지 않습니다.
        </p>
      </Card>

      {/* 운영 시간 안내 */}
      <Card className="mb-8 bg-blue-50 border border-blue-200">
        <div className="flex items-start gap-3">
          <div>
            <p className="font-semibold text-blue-900 mb-2">운영 시간</p>
            <div className="space-y-1 text-sm text-blue-800">
              <p>조식: 08:00 ~ 09:30</p>
              <p>중식: 11:30 ~ 14:00 (A/B 코너 운영)</p>
              <p>석식: 17:30 ~ 18:30 (금요일 휴무)</p>
            </div>
          </div>
        </div>
      </Card>

      {/* 알레르기 정보 */}
      <Card className="mb-8 bg-amber-50 border border-amber-200">
        <p className="text-sm text-amber-900 flex items-start gap-2">
          <Icon
            name="alert-circle"
            size={16}
            className="flex-shrink-0 mt-0.5"
            color="rgb(161, 98, 7)"
          />
          <span>
            <strong>알레르기 정보:</strong> 음식 알레르기가 있다면 표시된 항목을
            참고하여 식사를 선택하세요.
          </span>
        </p>
      </Card>

      <div className="space-y-6">
        {isLoading && <Skeleton count={3} height="200px" />}

        {!isLoading &&
          menus &&
          menus.map((menu) => {
            const isToday =
              menu.date === todayInfo.dateString && !todayInfo.isWeekend;
            return (
              <Card
                key={menu.id}
                className={
                  isToday
                    ? "bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-400"
                    : ""
                }
              >
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h2
                      className={`text-lg font-bold ${
                        isToday ? "text-green-900" : "text-neutral-900"
                      }`}
                    >
                      {menu.dayOfWeek}요일 ({menu.date})
                      {isToday && (
                        <span className="ml-2 text-green-700 font-semibold text-base">
                          (오늘)
                        </span>
                      )}
                    </h2>
                  </div>
                  <p
                    className={`text-sm ${
                      isToday ? "text-green-700" : "text-neutral-600"
                    }`}
                  >
                    {menu.location}
                  </p>
                </div>

                <div className="space-y-4">
                  {/* 조식 */}
                  <div>
                    <Badge color="blue" size="sm" className="mb-2">
                      조식
                    </Badge>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {menu.breakfast.map((item, idx) => (
                        <div key={idx} className="text-sm">
                          <p className="text-neutral-700 font-medium">
                            {item.name}
                          </p>
                          {item.calories && (
                            <p className="text-xs text-neutral-500">
                              {item.calories}kcal
                            </p>
                          )}
                          {item.allergens && (
                            <p className="text-xs text-red-600 flex items-center">
                              <Icon
                                name="alert-circle"
                                size={14}
                                className="mr-1 flex-shrink-0"
                                color="rgb(220, 38, 38)"
                              />
                              {item.allergens.join(", ")}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <hr className="border-neutral-200" />

                  {/* 중식 */}
                  <div>
                    <Badge color="green" size="sm" className="mb-2">
                      중식
                    </Badge>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* A 코너 */}
                      {menu.lunch.a && menu.lunch.a.length > 0 && (
                        <div className="border border-green-200 rounded-lg p-3">
                          <p className="text-xs font-semibold text-green-700 mb-2">
                            A 코너
                          </p>
                          <div className="space-y-2">
                            {menu.lunch.a.map((item, idx) => (
                              <div key={idx} className="text-sm">
                                <p className="text-neutral-700 font-medium">
                                  {item.name}
                                </p>
                                {item.calories && (
                                  <p className="text-xs text-neutral-500">
                                    {item.calories}kcal
                                  </p>
                                )}
                                {item.allergens && (
                                  <p className="text-xs text-red-600 flex items-center">
                                    <Icon
                                      name="alert-circle"
                                      size={14}
                                      className="mr-1 flex-shrink-0"
                                      color="rgb(220, 38, 38)"
                                    />
                                    {item.allergens.join(", ")}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* B 코너 */}
                      {menu.lunch.b && menu.lunch.b.length > 0 && (
                        <div className="border border-green-200 rounded-lg p-3">
                          <p className="text-xs font-semibold text-green-700 mb-2">
                            B 코너
                          </p>
                          <div className="space-y-2">
                            {menu.lunch.b.map((item, idx) => (
                              <div key={idx} className="text-sm">
                                <p className="text-neutral-700 font-medium">
                                  {item.name}
                                </p>
                                {item.calories && (
                                  <p className="text-xs text-neutral-500">
                                    {item.calories}kcal
                                  </p>
                                )}
                                {item.allergens && (
                                  <p className="text-xs text-red-600 flex items-center">
                                    <Icon
                                      name="alert-circle"
                                      size={14}
                                      className="mr-1 flex-shrink-0"
                                      color="rgb(220, 38, 38)"
                                    />
                                    {item.allergens.join(", ")}
                                  </p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <hr className="border-neutral-200" />

                  {/* 석식 */}
                  <div>
                    <Badge color="red" size="sm" className="mb-2">
                      석식
                    </Badge>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {menu.dinner.map((item, idx) => (
                        <div key={idx} className="text-sm">
                          <p className="text-neutral-700 font-medium">
                            {item.name}
                          </p>
                          {item.calories && (
                            <p className="text-xs text-neutral-500">
                              {item.calories}kcal
                            </p>
                          )}
                          {item.allergens && (
                            <p className="text-xs text-red-600 flex items-center">
                              <Icon
                                name="alert-circle"
                                size={14}
                                className="mr-1 flex-shrink-0"
                                color="rgb(220, 38, 38)"
                              />
                              {item.allergens.join(", ")}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
      </div>
    </Container>
  );
}
