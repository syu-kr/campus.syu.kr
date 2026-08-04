import { describe, expect, it } from "vitest";

import {
  filterLectureTimetableCourses,
  getLectureCourseSearchMatches,
  type LectureTimetableFilters,
} from "@/lib/lecture-timetable-filter";
import type { LectureTimetableCourse } from "@/lib/lecture-timetable";

const courses: LectureTimetableCourse[] = [
  {
    id: "A-01",
    courseName: "데이터베이스",
    normalizedName: "데이터베이스",
    departmentName: "컴퓨터공학부",
    collegeName: "미래융합대학",
    grade: 2,
    completionType: "전공선택",
    areaType: "디지털 리터러시",
    credits: 3,
    professor: "김교수",
    classTime: "월3~4,수3",
    timeSlots: [
      { day: "월", startPeriod: 3, endPeriod: 4 },
      { day: "수", startPeriod: 3, endPeriod: 3 },
    ],
    place: "제1실습관 201호",
    note: "인공지능 연계전공 인정과목",
  },
  {
    id: "B-01",
    courseName: "글쓰기",
    normalizedName: "글쓰기",
    grade: 1,
    completionType: "교양필수",
    credits: 2,
    classTime: "화7~8",
    timeSlots: [{ day: "화", startPeriod: 7, endPeriod: 8 }],
  },
  {
    id: "C-01",
    courseName: "현장실습",
    normalizedName: "현장실습",
    credits: 3,
    timeSlots: [],
    note: "수업시간 추후 공지",
  },
];

const emptyFilters: LectureTimetableFilters = {
  query: "",
  department: "",
  grade: "",
  completionType: "",
  days: [],
  startPeriod: null,
  endPeriod: null,
};

describe("lecture timetable filters", () => {
  it("searches area, note, college, place, and other course metadata", () => {
    expect(getLectureCourseSearchMatches(courses[0], "리터러시")).toContain(
      "areaType",
    );
    expect(getLectureCourseSearchMatches(courses[0], "연계전공")).toContain(
      "note",
    );
    expect(getLectureCourseSearchMatches(courses[0], "미래융합")).toContain(
      "collegeName",
    );
    expect(getLectureCourseSearchMatches(courses[0], "201호")).toContain(
      "place",
    );
  });

  it("matches a course when at least one selected day is present", () => {
    const filtered = filterLectureTimetableCourses(courses, {
      ...emptyFilters,
      days: ["수", "금"],
    });

    expect(filtered.map((course) => course.id)).toEqual(["A-01"]);
  });

  it("matches any overlapping class slot in the selected period range", () => {
    const filtered = filterLectureTimetableCourses(courses, {
      ...emptyFilters,
      days: ["월"],
      startPeriod: 4,
      endPeriod: 6,
    });

    expect(filtered.map((course) => course.id)).toEqual(["A-01"]);
  });

  it("requires day and period filters to match the same class slot", () => {
    const filtered = filterLectureTimetableCourses(courses, {
      ...emptyFilters,
      days: ["수"],
      startPeriod: 7,
      endPeriod: 8,
    });

    expect(filtered).toEqual([]);
  });

  it("excludes unscheduled courses only while a time filter is active", () => {
    expect(filterLectureTimetableCourses(courses, emptyFilters)).toHaveLength(3);
    expect(
      filterLectureTimetableCourses(courses, {
        ...emptyFilters,
        startPeriod: 1,
        endPeriod: 15,
      }).map((course) => course.id),
    ).toEqual(["A-01", "B-01"]);
  });
});
