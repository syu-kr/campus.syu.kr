"use client";

import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";
import { Skeleton } from "@/app/components/Skeleton";
import { useQuery } from "@tanstack/react-query";
import { fetchScholarships } from "@/lib/api";
import { formatNumber, formatDateKorean } from "@/lib/utils";
import { useState } from "react";

export default function ScholarshipPage() {
  const [selectedType, setSelectedType] = useState<
    "internal" | "external" | "all"
  >("all");

  const { data: allScholarships, isLoading } = useQuery({
    queryKey: ["scholarships"],
    queryFn: () => fetchScholarships(),
    staleTime: 5 * 60 * 1000,
  });

  const scholarships = allScholarships?.filter(
    (s) => selectedType === "all" || s.type === selectedType,
  );

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          장학금
        </h1>
        <p className="text-neutral-600">교내/외 장학금 정보를 확인하세요</p>
      </div>

      {/* 필터 */}
      <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
        <button
          onClick={() => setSelectedType("all")}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            selectedType === "all"
              ? "bg-primary-600 text-white"
              : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
          }`}
        >
          전체
        </button>
        <button
          onClick={() => setSelectedType("internal")}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            selectedType === "internal"
              ? "bg-primary-600 text-white"
              : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
          }`}
        >
          교내 장학금
        </button>
        <button
          onClick={() => setSelectedType("external")}
          className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            selectedType === "external"
              ? "bg-primary-600 text-white"
              : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
          }`}
        >
          교외 장학금
        </button>
      </div>

      {/* 장학금 목록 */}
      <div className="space-y-4">
        {isLoading && <Skeleton count={4} height="150px" />}

        {!isLoading &&
          scholarships &&
          scholarships.map((scholarship) => (
            <Card key={scholarship.id}>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <h2 className="text-lg font-bold text-neutral-900 mb-2">
                    {scholarship.name}
                  </h2>
                  <Badge
                    color={scholarship.type === "internal" ? "blue" : "green"}
                    size="sm"
                  >
                    {scholarship.type === "internal" ? "교내" : "교외"} 장학금
                  </Badge>
                </div>
                <span className="text-2xl">🎓</span>
              </div>

              <div className="space-y-3 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-neutral-600 mb-1">장학금액</p>
                    <p className="font-bold text-primary-600">
                      {formatNumber(scholarship.amount)} 원
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-neutral-600 mb-1">신청 마감일</p>
                    <p className="font-semibold text-neutral-900">
                      {formatDateKorean(scholarship.deadline)}
                    </p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-neutral-600 mb-1">지원 자격</p>
                  <p className="text-sm text-neutral-700">
                    {scholarship.eligibility}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-neutral-600 mb-1">설명</p>
                  <p className="text-sm text-neutral-700">
                    {scholarship.description}
                  </p>
                </div>

                <div className="pt-3 border-t border-neutral-200">
                  <button className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors w-full">
                    신청하기
                  </button>
                </div>
              </div>
            </Card>
          ))}
      </div>

      {!isLoading && scholarships?.length === 0 && (
        <div className="text-center py-12">
          <p className="text-neutral-600">해당하는 장학금이 없습니다</p>
        </div>
      )}

      {/* 주의사항 */}
      <Card className="mt-8 bg-yellow-50 border border-yellow-200">
        <p className="text-sm text-yellow-900 mb-2">
          💡 <strong>중요:</strong> 장학금 신청 기간과 자격요건을 반드시
          확인하세요.
        </p>
        <p className="text-xs text-yellow-800">
          자세한 정보는 학생지원팀 또는 각 기관의 공식 안내를 참고하시기
          바랍니다.
        </p>
      </Card>
    </Container>
  );
}
