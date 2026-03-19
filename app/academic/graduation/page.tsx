"use client";

import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import { MockDataAlert } from "@/app/components/MockDataAlert";
import { useState } from "react";

interface Requirement {
  title: string;
  required: number;
  completed: number;
  percentage: number;
  details?: Array<{
    name: string;
    completed: boolean;
  }>;
}

export default function GraduationPage() {
  const requirements: Requirement[] = [
    {
      title: "총 이수학점",
      required: 130,
      completed: 115,
      percentage: 88,
      details: [
        { name: "1학년", completed: true },
        { name: "2학년", completed: true },
        { name: "3학년", completed: true },
        { name: "4학년 1학기", completed: true },
        { name: "4학년 2학기", completed: false },
      ],
    },
    {
      title: "전공학점",
      required: 54,
      completed: 54,
      percentage: 100,
      details: [
        { name: "필수 전공 과목", completed: true },
        { name: "선택 전공 과목", completed: true },
        { name: "심화 과목", completed: true },
      ],
    },
    {
      title: "교양학점",
      required: 36,
      completed: 34,
      percentage: 94,
      details: [
        { name: "기초 교양", completed: true },
        { name: "일반 교양", completed: true },
        { name: "자유 선택", completed: false },
      ],
    },
  ];

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          졸업요건
        </h1>
        <p className="text-neutral-600">졸업 요건 체크리스트</p>
      </div>

      <MockDataAlert
        title="💡 안내"
        message="이 페이지의 졸업요건 데이터는 Mock 데이터입니다. 정확한 졸업요건은 학사시스템에서 확인하시기 바랍니다."
        type="info"
      />

      <div className="space-y-4">
        {requirements.map((req, index) => (
          <Card key={req.title}>
            <div
              className="cursor-pointer"
              onClick={() =>
                setExpandedIndex(expandedIndex === index ? null : index)
              }
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-neutral-900">
                    {req.title}
                  </h3>
                  <span
                    className={`text-xs px-2 py-1 rounded ${
                      req.percentage === 100
                        ? "bg-green-100 text-green-700"
                        : req.percentage >= 90
                          ? "bg-blue-100 text-blue-700"
                          : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {req.percentage >= 90 ? "거의 완료" : "진행 중"}
                  </span>
                </div>
                <span className="text-sm font-bold text-primary-600">
                  {req.completed}/{req.required}
                </span>
              </div>
              <div className="w-full bg-neutral-200 rounded-full h-3 mb-2">
                <div
                  className={`h-3 rounded-full transition-all ${
                    req.percentage === 100 ? "bg-green-500" : "bg-primary-600"
                  }`}
                  style={{ width: `${req.percentage}%` }}
                ></div>
              </div>
              <p className="text-xs text-neutral-600">{req.percentage}% 달성</p>
            </div>

            {/* 세부 항목 */}
            {expandedIndex === index && req.details && (
              <div className="mt-4 pt-4 border-t border-neutral-200">
                <p className="text-sm font-semibold text-neutral-900 mb-3">
                  세부 요건:
                </p>
                <div className="space-y-2">
                  {req.details.map((detail) => (
                    <div
                      key={detail.name}
                      className="flex items-center gap-3 p-2 bg-neutral-50 rounded"
                    >
                      <input
                        type="checkbox"
                        checked={detail.completed}
                        onChange={() => {}}
                        className="w-4 h-4 accent-primary-600"
                      />
                      <span
                        className={`text-sm ${
                          detail.completed
                            ? "text-neutral-600 line-through"
                            : "text-neutral-900"
                        }`}
                      >
                        {detail.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>

      {/* 졸업 예상 */}
      <Card className="mt-8 bg-green-50 border border-green-200">
        <p className="text-sm text-green-900 mb-2">
          ✅ <strong>경축:</strong> 졸업 요건을 거의 충족하셨습니다!
        </p>
        <p className="text-xs text-green-800">2025년 2월 졸업 예정입니다.</p>
      </Card>
    </Container>
  );
}
