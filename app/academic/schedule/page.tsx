"use client";

import { Metadata } from "next";
import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { Skeleton } from "@/app/components/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { fetchAcademicSchedules } from "@/lib/api";
import {
  formatDateRange,
  getCategoryColor,
  getCategoryLabel,
} from "@/lib/utils";

export default function SchedulePage() {
  const { data: schedules, isLoading } = useQuery({
    queryKey: ["schedules"],
    queryFn: () => fetchAcademicSchedules(),
    staleTime: 5 * 60 * 1000,
  });

  const groupedSchedules = schedules?.reduce(
    (acc, schedule) => {
      if (!acc[schedule.category]) {
        acc[schedule.category] = [];
      }
      acc[schedule.category].push(schedule);
      return acc;
    },
    {} as Record<string, typeof schedules>,
  );

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          학사일정
        </h1>
        <p className="text-neutral-600">2024학년도 학사일정을 확인하세요</p>
      </div>

      <div className="space-y-8">
        {isLoading && <Skeleton count={4} height="100px" />}

        {!isLoading &&
          groupedSchedules &&
          Object.entries(groupedSchedules).map(([category, items]) => (
            <div key={category}>
              <h2 className="text-lg font-semibold text-neutral-900 mb-4 flex items-center gap-2">
                <Badge color={getCategoryColor(category)}>
                  {getCategoryLabel(category)}
                </Badge>
              </h2>
              <div className="space-y-3">
                {items?.map((schedule) => (
                  <Card key={schedule.id}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-neutral-900 mb-1">
                          {schedule.title}
                        </h3>
                        <p className="text-xs text-neutral-600 mb-2">
                          {formatDateRange(
                            schedule.startDate,
                            schedule.endDate,
                          )}
                        </p>
                        {schedule.description && (
                          <p className="text-sm text-neutral-700">
                            {schedule.description}
                          </p>
                        )}
                      </div>
                      <div className="text-2xl">
                        {schedule.category === "exam"
                          ? "📝"
                          : schedule.category === "registration"
                            ? "✍️"
                            : "📅"}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
      </div>

      {/* 실제 백엔드 연동 시 주의사항 */}
      <Card className="mt-8 bg-yellow-50 border border-yellow-200">
        <p className="text-sm text-yellow-900">
          💡 <strong>Tip:</strong> 학사일정은 학습 목적으로 샘플 데이터입니다.
          실제 일정은 학사시스템을 통해 확인하세요.
        </p>
      </Card>
    </Container>
  );
}
