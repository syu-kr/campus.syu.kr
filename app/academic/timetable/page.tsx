"use client";

import { Container } from "@/app/components/Container";
import { Card } from "@/app/components/Card";
import { useState, useMemo } from "react";

interface Course {
  id: string;
  name: string;
  professor: string;
  credit: number;
  time: string;
  day: string[];
  startTime: number;
  endTime: number;
  capacity: string;
  color: string;
  category:
    | "major-required"
    | "liberal-required"
    | "major-elective"
    | "liberal-elective";
}

const AVAILABLE_COURSES: Course[] = [
  {
    id: "1",
    name: "데이터베이스",
    professor: "김교수",
    credit: 3,
    time: "월목 10:00-11:30",
    day: ["월", "목"],
    startTime: 10,
    endTime: 11.5,
    capacity: "40/40",
    color: "bg-blue-100 border-blue-300",
    category: "major-required",
  },
  {
    id: "2",
    name: "웹프로그래밍 실습",
    professor: "이교수",
    credit: 2,
    time: "화금 14:00-15:30",
    day: ["화", "금"],
    startTime: 14,
    endTime: 15.5,
    capacity: "35/35",
    color: "bg-green-100 border-green-300",
    category: "major-elective",
  },
  {
    id: "3",
    name: "소프트웨어공학",
    professor: "박교수",
    credit: 3,
    time: "월수 13:00-14:30",
    day: ["월", "수"],
    startTime: 13,
    endTime: 14.5,
    capacity: "38/40",
    color: "bg-purple-100 border-purple-300",
    category: "major-required",
  },
  {
    id: "4",
    name: "인공지능",
    professor: "최교수",
    credit: 3,
    time: "수금 09:00-10:30",
    day: ["수", "금"],
    startTime: 9,
    endTime: 10.5,
    capacity: "39/40",
    color: "bg-orange-100 border-orange-300",
    category: "major-elective",
  },
  {
    id: "5",
    name: "모바일앱개발",
    professor: "정교수",
    credit: 3,
    time: "화목 15:00-16:30",
    day: ["화", "목"],
    startTime: 15,
    endTime: 16.5,
    capacity: "30/40",
    color: "bg-pink-100 border-pink-300",
    category: "major-required",
  },
  {
    id: "6",
    name: "사회학개론",
    professor: "강교수",
    credit: 3,
    time: "월수 11:00-12:30",
    day: ["월", "수"],
    startTime: 11,
    endTime: 12.5,
    capacity: "50/50",
    color: "bg-red-100 border-red-300",
    category: "liberal-required",
  },
  {
    id: "7",
    name: "철학입문",
    professor: "정교수",
    credit: 3,
    time: "화금 10:00-11:30",
    day: ["화", "금"],
    startTime: 10,
    endTime: 11.5,
    capacity: "40/40",
    color: "bg-indigo-100 border-indigo-300",
    category: "liberal-required",
  },
  {
    id: "8",
    name: "현대미술",
    professor: "류교수",
    credit: 2,
    time: "목 15:00-17:00",
    day: ["목"],
    startTime: 15,
    endTime: 17,
    capacity: "30/30",
    color: "bg-cyan-100 border-cyan-300",
    category: "liberal-elective",
  },
];

export default function TimetableWizardPage() {
  const [selectedCourses, setSelectedCourses] = useState<Course[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [filterCategories, setFilterCategories] = useState<Set<string>>(
    new Set(),
  );

  const days = ["월", "화", "수", "목", "금"];
  const hours = Array.from({ length: 9 }, (_, i) => i + 8);

  // 필터링 및 검색 로직
  const filteredCourses = useMemo(() => {
    return AVAILABLE_COURSES.filter((course) => {
      const matchesSearch =
        course.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        course.professor.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesFilter =
        filterCategories.size === 0 || filterCategories.has(course.category);

      return matchesSearch && matchesFilter;
    });
  }, [searchQuery, filterCategories]);

  // 카테고리별 통계
  const categoryStats = useMemo(() => {
    const stats = {
      "major-required": 0,
      "liberal-required": 0,
      "major-elective": 0,
      "liberal-elective": 0,
    };
    selectedCourses.forEach((course) => {
      stats[course.category]++;
    });
    return stats;
  }, [selectedCourses]);

  // 카테고리별 학점
  const creditsByCategory = useMemo(() => {
    const credits = {
      "major-required": 0,
      "liberal-required": 0,
      "major-elective": 0,
      "liberal-elective": 0,
    };
    selectedCourses.forEach((course) => {
      credits[course.category] += course.credit;
    });
    return credits;
  }, [selectedCourses]);

  // 시간 충돌 검사 (어떤 과목과 충돌하는지 반환)
  const getConflictingCourses = (newCourse: Course): Course[] => {
    return selectedCourses.filter((selected) => {
      const sharedDays = newCourse.day.filter((d) => selected.day.includes(d));
      if (sharedDays.length === 0) return false;
      return !(
        newCourse.endTime <= selected.startTime ||
        newCourse.startTime >= selected.endTime
      );
    });
  };

  // 선택된 과목 중 시간 충돌 확인
  const getTimeConflicts = useMemo(() => {
    const conflicts: Record<string, string[]> = {};
    selectedCourses.forEach((course) => {
      const conflicting = selectedCourses.filter((other) => {
        if (course.id === other.id) return false;
        const sharedDays = course.day.filter((d) => other.day.includes(d));
        if (sharedDays.length === 0) return false;
        return !(
          course.endTime <= other.startTime || course.startTime >= other.endTime
        );
      });
      if (conflicting.length > 0) {
        conflicts[course.id] = conflicting.map((c) => c.name);
      }
    });
    return conflicts;
  }, [selectedCourses]);

  const totalCredits = useMemo(
    () => selectedCourses.reduce((sum, course) => sum + course.credit, 0),
    [selectedCourses],
  );

  const handleAddCourse = (course: Course) => {
    const conflicting = getConflictingCourses(course);
    if (conflicting.length > 0) {
      alert(
        `시간이 충돌합니다! 다음 과목과 겹칩니다:\n${conflicting.map((c) => c.name).join(", ")}`,
      );
      return;
    }
    if (totalCredits + course.credit > 18) {
      alert("최대 18학점을 초과할 수 없습니다!");
      return;
    }
    setSelectedCourses([...selectedCourses, course]);
  };

  const handleRemoveCourse = (courseId: string) => {
    setSelectedCourses(
      selectedCourses.filter((course) => course.id !== courseId),
    );
  };

  const toggleFilter = (category: string) => {
    const newFilter = new Set(filterCategories);
    if (newFilter.has(category)) {
      newFilter.delete(category);
    } else {
      newFilter.add(category);
    }
    setFilterCategories(newFilter);
  };

  const getCategoryLabel = (category: string): string => {
    const labels: Record<string, string> = {
      "major-required": "전공 필수",
      "major-elective": "전공 선택",
      "liberal-required": "교양 필수",
      "liberal-elective": "교양 선택",
    };
    return labels[category] || "";
  };

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          시간표 짜기
        </h1>
        <p className="text-neutral-600">
          원하는 과목을 선택하여 시간표를 작성하세요
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 왼쪽: 시간표 */}
        <div className="lg:col-span-2">
          <Card className="p-0 overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-neutral-300">
                  <th className="p-2 text-left text-sm font-semibold bg-neutral-100 w-16">
                    시간
                  </th>
                  {days.map((day) => (
                    <th
                      key={day}
                      className="p-2 text-center text-sm font-semibold bg-neutral-100 flex-1"
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hours.map((hour) => (
                  <tr key={hour} className="border-b border-neutral-200">
                    <td className="p-2 text-center text-xs font-semibold text-neutral-600">
                      {hour}:00
                    </td>
                    {days.map((day) => {
                      const coursesAtSlot = selectedCourses.filter(
                        (course) =>
                          course.day.includes(day) &&
                          course.startTime <= hour &&
                          hour < course.endTime,
                      );

                      return (
                        <td
                          key={`${day}-${hour}`}
                          className="p-1 text-center text-xs border-l border-neutral-200 relative h-12"
                        >
                          {coursesAtSlot.map((course) => (
                            <div
                              key={course.id}
                              className={`p-1 rounded text-xs font-semibold h-full flex items-center justify-center border ${course.color}`}
                            >
                              {course.name}
                            </div>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          {/* 범례 */}
          <div className="mt-4 flex items-center gap-4 text-xs text-neutral-600">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-300 rounded"></div>
              <span>충돌 없음</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-300 rounded"></div>
              <span>시간 충돌</span>
            </div>
          </div>
        </div>

        {/* 오른쪽: 과목 목록 및 선택 현황 */}
        <div className="space-y-4">
          {/* 선택 현황 */}
          <Card className="bg-blue-50 border border-blue-200">
            <h3 className="font-semibold text-neutral-900 mb-3">
              📊 선택 현황
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span>총 학점:</span>
                <span
                  className={`font-bold ${
                    totalCredits > 18 ? "text-red-600" : "text-blue-600"
                  }`}
                >
                  {totalCredits}학점
                </span>
              </div>

              {/* 카테고리별 학점 */}
              <div className="pt-2 border-t border-blue-200 space-y-1">
                <p className="text-xs font-semibold text-neutral-700">
                  카테고리별:
                </p>
                {(
                  [
                    "major-required",
                    "major-elective",
                    "liberal-required",
                    "liberal-elective",
                  ] as const
                ).map((category) => {
                  const count = categoryStats[category];
                  const credits = creditsByCategory[category];
                  return (
                    <div
                      key={category}
                      className="text-xs text-neutral-600 flex justify-between"
                    >
                      <span>{getCategoryLabel(category)}:</span>
                      <span className="font-semibold">
                        {credits}학점 ({count}개)
                      </span>
                    </div>
                  );
                })}
              </div>

              {totalCredits > 3 && totalCredits <= 18 && (
                <div className="pt-2 border-t border-blue-200">
                  <p className="text-xs text-blue-800">✅ 최소 학점 충족</p>
                </div>
              )}
            </div>

            {/* 필터 버튼 */}
            <div className="mt-4 pt-4 border-t border-blue-200">
              <p className="text-xs font-semibold text-neutral-700 mb-2">
                필터:
              </p>
              <div className="space-y-2">
                {(
                  [
                    "major-required",
                    "major-elective",
                    "liberal-required",
                    "liberal-elective",
                  ] as const
                ).map((category) => (
                  <label
                    key={category}
                    className="flex items-center gap-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={filterCategories.has(category)}
                      onChange={() => toggleFilter(category)}
                      className="w-4 h-4 rounded border-neutral-300"
                    />
                    <span className="text-sm text-neutral-700">
                      {getCategoryLabel(category)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </Card>

          {/* 선택된 과목 목록 */}
          {selectedCourses.length > 0 && (
            <Card className="bg-green-50 border border-green-200">
              <h3 className="font-semibold text-neutral-900 mb-3">
                선택된 과목 ({selectedCourses.length})
              </h3>
              <div className="space-y-2">
                {selectedCourses.map((course) => {
                  const conflicts = getTimeConflicts[course.id];
                  return (
                    <div
                      key={course.id}
                      className="flex items-start justify-between p-2 bg-white rounded border border-green-200"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-neutral-900">
                          {course.name}
                        </p>
                        <p className="text-xs text-neutral-600">
                          {course.professor} | {course.credit}학점
                        </p>
                        <p className="text-xs text-neutral-500">
                          {course.time}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {getCategoryLabel(course.category)}
                        </p>
                        {conflicts && conflicts.length > 0 && (
                          <p className="text-xs text-red-600 mt-1">
                            ⚠️ {conflicts.join(", ")}과 시간 겹침
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleRemoveCourse(course.id)}
                        className="text-red-600 hover:text-red-700 font-bold text-lg ml-2"
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* 강의 목록 */}
          <Card>
            <h3 className="font-semibold text-neutral-900 mb-3">
              📚 강의 목록
            </h3>

            {/* 검색창 */}
            <input
              type="text"
              placeholder="과목명 또는 교수명으로 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 mb-3 border border-neutral-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredCourses
                .filter(
                  (course) => !selectedCourses.some((s) => s.id === course.id),
                )
                .map((course) => {
                  const conflicting = getConflictingCourses(course);
                  const creditExceeds = totalCredits + course.credit > 18;
                  const hasConflicts = conflicting.length > 0;

                  return (
                    <button
                      key={course.id}
                      onClick={() => handleAddCourse(course)}
                      disabled={hasConflicts || creditExceeds}
                      className={`w-full p-2 rounded border text-left transition ${
                        hasConflicts || creditExceeds
                          ? "opacity-50 cursor-not-allowed bg-neutral-100 border-neutral-300"
                          : "hover:bg-neutral-50 border-neutral-300"
                      }`}
                    >
                      <p className="text-sm font-semibold text-neutral-900">
                        {course.name}
                      </p>
                      <p className="text-xs text-neutral-600">
                        {course.professor} | {course.credit}학점
                      </p>
                      <p className="text-xs text-neutral-500">
                        {getCategoryLabel(course.category)}
                      </p>
                      {hasConflicts && (
                        <p className="text-xs text-red-600 mt-1">
                          ⚠️ {conflicting.map((c) => c.name).join(", ")}과 시간
                          충돌
                        </p>
                      )}
                      {creditExceeds && (
                        <p className="text-xs text-orange-600">⚠️ 학점 초과</p>
                      )}
                    </button>
                  );
                })}
            </div>
          </Card>
        </div>
      </div>
    </Container>
  );
}
