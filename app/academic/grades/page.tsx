"use client";

import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import { Badge } from "@/app/components/Badge";

export default function GradesPage() {
  const courses = [
    {
      id: "1",
      name: "데이터베이스",
      professor: "김교수",
      credit: 3,
      grade: "A+",
      score: 95,
    },
    {
      id: "2",
      name: "웹프로그래밍",
      professor: "이교수",
      credit: 3,
      grade: "A",
      score: 92,
    },
    {
      id: "3",
      name: "컴퓨터네트워크",
      professor: "박교수",
      credit: 3,
      grade: "A+",
      score: 94,
    },
    {
      id: "4",
      name: "알고리즘",
      professor: "최교수",
      credit: 4,
      grade: "A",
      score: 90,
    },
  ];

  const getGradeColor = (grade: string) => {
    if (grade === "A+") return "green";
    if (grade === "A") return "green";
    if (grade === "B+") return "blue";
    if (grade === "B") return "blue";
    return "yellow";
  };

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          학점조회
        </h1>
        <p className="text-neutral-600">2024-1학기 성적을 확인하세요</p>
      </div>

      {/* 학기 GPA */}
      <Card className="mb-6 bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-200">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-neutral-600 mb-1">학기 GPA</p>
            <p className="text-2xl font-bold text-primary-600">3.92</p>
          </div>
          <div>
            <p className="text-xs text-neutral-600 mb-1">평점평균</p>
            <p className="text-2xl font-bold text-primary-600">3.85</p>
          </div>
          <div>
            <p className="text-xs text-neutral-600 mb-1">이수학점</p>
            <p className="text-2xl font-bold text-primary-600">13</p>
          </div>
          <div>
            <p className="text-xs text-neutral-600 mb-1">누적학점</p>
            <p className="text-2xl font-bold text-primary-600">115</p>
          </div>
        </div>
      </Card>

      {/* 성적 목록 */}
      <div className="space-y-3">
        {courses.map((course) => (
          <Card key={course.id}>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-neutral-900 mb-1">
                  {course.name}
                </h3>
                <p className="text-xs text-neutral-600 mb-2">
                  {course.professor} • {course.credit}학점
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-neutral-900">
                  {course.score}
                </p>
                <Badge color={getGradeColor(course.grade)} size="sm">
                  {course.grade}
                </Badge>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* 주의사항 */}
      <Card className="mt-8 bg-blue-50 border border-blue-200">
        <p className="text-sm text-blue-900">
          💡 이 페이지의 데이터는 Mock 데이터입니다. 실제 성적은 학사시스템을
          통해 확인하세요.
        </p>
      </Card>
    </Container>
  );
}
