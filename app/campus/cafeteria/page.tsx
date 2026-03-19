"use client";

import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { Skeleton } from "@/app/components/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { fetchCafeteriaMenu } from "@/lib/api";

export default function CafeteriaPage() {
  const { data: menus, isLoading } = useQuery({
    queryKey: ["cafeteria-weekly"],
    queryFn: fetchCafeteriaMenu,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          학식
        </h1>
        <p className="text-neutral-600">주간 식단 및 영양정보를 확인하세요</p>
      </div>

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
                  <span className="text-2xl">🍽️</span>
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
                          <p className="text-xs text-red-600">
                            ⚠️ {item.allergens.join(", ")}
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {menu.lunch.map((item, idx) => (
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
                          <p className="text-xs text-red-600">
                            ⚠️ {item.allergens.join(", ")}
                          </p>
                        )}
                      </div>
                    ))}
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
                          <p className="text-xs text-red-600">
                            ⚠️ {item.allergens.join(", ")}
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
        <p className="text-sm text-yellow-900">
          💡 <strong>알레르기 정보:</strong> 음식 알레르기가 있다면 표시된
          정보를 참고하여 식사를 선택하세요.
        </p>
      </Card>
    </Container>
  );
}
