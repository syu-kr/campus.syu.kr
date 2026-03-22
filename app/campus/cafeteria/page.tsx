"use client";

import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { Skeleton } from "@/app/components/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { fetchCafeteriaMenu } from "@/lib/api";
import { useMemo } from "react";
import { AlertCircle } from "lucide-react";

export default function CafeteriaPage() {
  const { data: menus, isLoading } = useQuery({
    queryKey: ["cafeteria-weekly"],
    queryFn: () => fetchCafeteriaMenu(),
    staleTime: 5 * 60 * 1000,
  });

  // 오늘 날짜와 요일 계산
  const todayInfo = useMemo(() => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0: 일요일, 6: 토요일
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const dateString = today.toISOString().split("T")[0]; // YYYY-MM-DD
    return { dateString, isWeekend, dayOfWeek };
  }, []);

  // 오늘 식단 찾기
  const todayMenu = useMemo(() => {
    if (!menus) return null;
    return menus.find((menu) => menu.date === todayInfo.dateString);
  }, [menus, todayInfo]);

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          학식
        </h1>
        <p className="text-neutral-600">주간 식단 및 영양정보를 확인하세요</p>
      </div>

      {/* 만나의집 정보 */}
      <Card className="mt-8 bg-yellow-50 border border-yellow-200">
        <p className="text-sm text-yellow-900">
          <strong>만나의 집:</strong> 현재 만나의 집의 경우는 구현되어있지
          않습니다.
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
              <p>석식: 17:30 ~ 18:30</p>
            </div>
          </div>
        </div>
      </Card>

      {/* 오늘의 학식 */}
      {todayInfo.isWeekend ? (
        <Card className="mb-8 bg-neutral-100 border border-neutral-300">
          <div className="text-center py-6">
            <p className="text-lg font-semibold text-neutral-900 mb-1">
              오늘은 주말입니다.
            </p>
            <p className="text-sm text-neutral-600">
              주말을 알차게 보내보는건 어떨까요? 😊
            </p>
          </div>
        </Card>
      ) : isLoading ? (
        <Card className="mb-8 bg-green-50 border border-green-200">
          <Skeleton height="150px" />
        </Card>
      ) : todayInfo.dayOfWeek === 1 && !todayMenu ? (
        <Card className="mb-8 bg-yellow-50 border-2 border-yellow-400">
          <div className="text-center py-8">
            <p className="text-lg font-semibold text-yellow-900 mb-2">
              현재 최신화 작업 중입니다
            </p>
            <p className="text-sm text-yellow-700">
              데이터가 준비되고 있습니다. 잠시만 기다려주세요.
            </p>
          </div>
        </Card>
      ) : todayMenu ? (
        <Card className="mb-8 bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-400">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-bold text-green-900">
                🌟 오늘의 메뉴 🌟
              </h2>
            </div>
            <p className="text-sm text-green-700 font-medium">
              {todayMenu.dayOfWeek}요일 ({todayMenu.date})
            </p>
          </div>

          <div className="space-y-4">
            {/* 조식 */}
            <div>
              <Badge color="blue" size="sm" className="mb-2">
                조식
              </Badge>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {todayMenu.breakfast.map((item, idx) => (
                  <div key={idx} className="text-sm">
                    <p className="text-neutral-700 font-medium">{item.name}</p>
                    {item.calories && (
                      <p className="text-xs text-neutral-500">
                        {item.calories}kcal
                      </p>
                    )}
                    {item.allergens && (
                      <p className="text-xs text-red-600 flex items-center">
                        <AlertCircle size={14} className="mr-1 flex-shrink-0" />
                        {item.allergens.join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <hr className="border-green-200" />

            {/* 중식 */}
            <div>
              <Badge color="green" size="sm" className="mb-2">
                중식
              </Badge>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* A 코너 */}
                {todayMenu.lunch.a && todayMenu.lunch.a.length > 0 && (
                  <div className="border-2 border-green-400 rounded-lg p-3 bg-white">
                    <p className="text-xs font-semibold text-green-700 mb-2">
                      A 코너
                    </p>
                    <div className="space-y-2">
                      {todayMenu.lunch.a.map((item, idx) => (
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
                              <AlertCircle
                                size={14}
                                className="mr-1 flex-shrink-0"
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
                {todayMenu.lunch.b && todayMenu.lunch.b.length > 0 && (
                  <div className="border-2 border-green-400 rounded-lg p-3 bg-white">
                    <p className="text-xs font-semibold text-green-700 mb-2">
                      B 코너
                    </p>
                    <div className="space-y-2">
                      {todayMenu.lunch.b.map((item, idx) => (
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
                              <AlertCircle
                                size={14}
                                className="mr-1 flex-shrink-0"
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

            <hr className="border-green-200" />

            {/* 석식 */}
            <div>
              <Badge color="red" size="sm" className="mb-2">
                석식
              </Badge>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {todayMenu.dinner.map((item, idx) => (
                  <div key={idx} className="text-sm">
                    <p className="text-neutral-700 font-medium">{item.name}</p>
                    {item.calories && (
                      <p className="text-xs text-neutral-500">
                        {item.calories}kcal
                      </p>
                    )}
                    {item.allergens && (
                      <p className="text-xs text-red-600 flex items-center">
                        <AlertCircle size={14} className="mr-1 flex-shrink-0" />
                        {item.allergens.join(", ")}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="mb-8 bg-red-50 border-2 border-red-400">
          <div className="text-center py-8">
            <p className="text-lg font-semibold text-red-900 mb-2">
              ❌ 데이터를 불러올 수 없습니다
            </p>
            <p className="text-sm text-red-700">
              일시적인 오류가 발생했습니다. 나중에 다시 시도해주세요.
            </p>
          </div>
        </Card>
      )}

      <div className="space-y-6">
        {isLoading && <Skeleton count={3} height="200px" />}

        {!isLoading &&
          menus &&
          menus.map((menu) => (
            <Card key={menu.id}>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-bold text-neutral-900">
                    {menu.dayOfWeek}요일 ({menu.date})
                  </h2>
                </div>
                <p className="text-sm text-neutral-600">{menu.location}</p>
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
                            <AlertCircle
                              size={14}
                              className="mr-1 flex-shrink-0"
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
                                  <AlertCircle
                                    size={14}
                                    className="mr-1 flex-shrink-0"
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
                                  <AlertCircle
                                    size={14}
                                    className="mr-1 flex-shrink-0"
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
                            <AlertCircle
                              size={14}
                              className="mr-1 flex-shrink-0"
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
          ))}
      </div>

      {/* 알레르기 정보 */}
      <Card className="mt-8 bg-yellow-50 border border-yellow-200">
        <p className="text-sm text-yellow-900 flex items-center">
          <AlertCircle
            size={16}
            className="mr-2 flex-shrink-0 text-yellow-700"
          />
          <strong>알레르기 정보:</strong> 음식 알레르기가 있다면 표시된 참고하여
          식사를 선택하세요.
        </p>
      </Card>
    </Container>
  );
}
