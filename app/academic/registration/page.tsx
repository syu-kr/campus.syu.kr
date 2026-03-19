"use client";

import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import { useState } from "react";

export default function RegistrationPage() {
  const [cart, setCart] = useState<string[]>([]);

  const availableCourses = [
    {
      id: "1",
      name: "데이터베이스",
      professor: "김교수",
      credit: 3,
      time: "월목 10:00-11:30",
      capacity: "40/40",
    },
    {
      id: "2",
      name: "웹프로그래밍 실습",
      professor: "이교수",
      credit: 2,
      time: "화금 14:00-15:30",
      capacity: "35/35",
    },
    {
      id: "3",
      name: "소프트웨어공학",
      professor: "박교수",
      credit: 3,
      time: "월수 13:00-14:30",
      capacity: "38/40",
    },
    {
      id: "4",
      name: "인공지능",
      professor: "최교수",
      credit: 3,
      time: "수금 09:00-10:30",
      capacity: "39/40",
    },
    {
      id: "5",
      name: "모바일앱개발",
      professor: "정교수",
      credit: 3,
      time: "화목 15:00-16:30",
      capacity: "30/40",
    },
  ];

  const handleAddCourse = (courseId: string) => {
    if (!cart.includes(courseId)) {
      setCart([...cart, courseId]);
    }
  };

  const handleRemoveCourse = (courseId: string) => {
    setCart(cart.filter((id) => id !== courseId));
  };

  const totalCredits = availableCourses
    .filter((c) => cart.includes(c.id))
    .reduce((sum, c) => sum + c.credit, 0);

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          수강신청
        </h1>
        <p className="text-neutral-600">
          시뮬레이션: 과목을 선택하여 수강신청을 체험해보세요
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 과목 목록 */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-neutral-900 mb-4">
            수강 가능 과목 ({availableCourses.length})
          </h2>
          <div className="space-y-3">
            {availableCourses.map((course) => (
              <Card
                key={course.id}
                className={`cursor-pointer transition-all ${
                  cart.includes(course.id)
                    ? "ring-2 ring-primary-500 bg-primary-50"
                    : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-neutral-900 mb-1">
                      {course.name}
                    </h3>
                    <p className="text-sm text-neutral-600 mb-2">
                      {course.professor} • {course.credit}학점
                    </p>
                    <p className="text-xs text-neutral-500">
                      {course.time} • {course.capacity}
                    </p>
                  </div>
                  <button
                    onClick={() =>
                      cart.includes(course.id)
                        ? handleRemoveCourse(course.id)
                        : handleAddCourse(course.id)
                    }
                    className={`px-4 py-2 rounded-lg font-medium transition-colors text-sm ${
                      cart.includes(course.id)
                        ? "bg-primary-600 text-white hover:bg-primary-700"
                        : "bg-neutral-200 text-neutral-900 hover:bg-neutral-300"
                    }`}
                  >
                    {cart.includes(course.id) ? "제거" : "추가"}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* 장바구니 */}
        <div className="lg:col-span-1">
          <Card className="sticky top-20 bg-primary-50 border-2 border-primary-300">
            <h3 className="font-semibold text-neutral-900 mb-4">
              🛒 수강신청 장바구니
            </h3>
            <div className="space-y-2 mb-4 pb-4 border-b border-primary-200">
              {cart.length === 0 ? (
                <p className="text-sm text-neutral-600">과목을 선택해주세요</p>
              ) : (
                availableCourses
                  .filter((c) => cart.includes(c.id))
                  .map((course) => (
                    <div
                      key={course.id}
                      className="text-sm text-neutral-700 flex items-center justify-between"
                    >
                      <span>{course.name}</span>
                      <span className="font-semibold">({course.credit})</span>
                    </div>
                  ))
              )}
            </div>
            <div className="text-lg font-bold text-primary-600 mb-4">
              총 {totalCredits}학점
            </div>
            <button className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors">
              수강신청 제출
            </button>
          </Card>
        </div>
      </div>

      {/* 주의사항 */}
      <Card className="mt-8 bg-blue-50 border border-blue-200">
        <p className="text-sm text-blue-900 mb-2">
          💡 <strong>주의:</strong> 이 페이지는 UI/UX 데모입니다.
        </p>
        <p className="text-xs text-blue-800">
          실제 수강신청은 학사시스템(LMS)을 통해 진행하세요.
        </p>
      </Card>
    </Container>
  );
}
