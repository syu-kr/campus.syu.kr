export type CourseCategory =
  | "major-required"
  | "liberal-required"
  | "major-elective"
  | "liberal-elective";

export interface Course {
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
  category: CourseCategory;
}

export const TIMETABLE_DAYS = ["월", "화", "수", "목", "금"];

export const TIMETABLE_HOURS = Array.from({ length: 9 }, (_, i) => i + 8);

export const COURSE_CATEGORIES: CourseCategory[] = [
  "major-required",
  "major-elective",
  "liberal-required",
  "liberal-elective",
];

export const AVAILABLE_COURSES: Course[] = [
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
