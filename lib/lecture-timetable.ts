export type LectureDay = "월" | "화" | "수" | "목" | "금" | "토" | "일";

export interface LectureTimeSlot {
  day: LectureDay;
  startPeriod: number;
  endPeriod: number;
}

export interface LectureTimetableCourse {
  id: string;
  courseCode?: string;
  courseName: string;
  normalizedName: string;
  departmentName?: string;
  collegeName?: string;
  grade?: number;
  completionType?: string;
  areaType?: string;
  credits: number | null;
  professor?: string;
  classTime?: string;
  timeSlots: LectureTimeSlot[];
  place?: string;
  note?: string;
  teamTeaching?: string;
  semesterLabel?: string;
  sourceYear?: string;
}

export interface LectureTimetableDataset {
  year?: string;
  semester?: string;
  updatedAt?: string;
  courses: LectureTimetableCourse[];
}

export type LectureMatchMap = Record<string, LectureTimetableCourse[]>;

const OCR_NAME_FIXES: Array<[RegExp, string]> = [
  [/글로걸/g, "글로컬"],
  [/글로컬영어/g, "글로컬 영어"],
  [/액스튼/g, "캡스톤"],
  [/캡스튼/g, "캡스톤"],
  [/플라우드/g, "클라우드"],
  [/데이타/g, "데이터"],
  [/빅데이타/g, "빅데이터"],
  [/악학/g, "약학"],
  [/간로/g, "진로"],
];

export function normalizeLectureTimetablePayload(
  payload: unknown,
): LectureTimetableDataset {
  const root = isRecord(payload) ? payload : {};
  const apiRoot = isRecord(root.api) ? root.api : root;
  const rows = Array.isArray(apiRoot.api)
    ? apiRoot.api
    : Array.isArray(root.data)
      ? root.data
      : Array.isArray(payload)
        ? payload
        : [];

  const year = stringValue(apiRoot.year);
  const semester = stringValue(apiRoot.semester);
  const updatedAt = stringValue(apiRoot.time);

  return {
    year,
    semester,
    updatedAt,
    courses: rows
      .map((row, index) =>
        normalizeLectureRow(row, index, {
          year,
          semester,
        }),
      )
      .filter((course): course is LectureTimetableCourse => Boolean(course)),
  };
}

export function normalizeCourseName(name: string): string {
  let normalized = name
    .normalize("NFKC")
    .replace(/Ⅰ/g, "I")
    .replace(/Ⅱ/g, "II")
    .replace(/Ⅲ/g, "III")
    .replace(/Ⅳ/g, "IV")
    .replace(/Ⅴ/g, "V")
    .replace(/Ⅵ/g, "VI")
    .replace(/Ⅶ/g, "VII")
    .replace(/Ⅷ/g, "VIII")
    .replace(/Ⅸ/g, "IX")
    .replace(/Ⅹ/g, "X");

  OCR_NAME_FIXES.forEach(([pattern, replacement]) => {
    normalized = normalized.replace(pattern, replacement);
  });

  return normalized
    .toLowerCase()
    .replace(/[\s·ㆍ.,:;()[\]{}<>《》「」'"]/g, "")
    .replace(/[ⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩ]/g, "")
    .trim();
}

export function parseLectureTimeSlots(classTime?: string): LectureTimeSlot[] {
  if (!classTime) return [];

  return classTime
    .split(",")
    .map((part) => part.trim())
    .flatMap((part) => {
      const match = part.match(/^([월화수목금토일])(\d+)(?:~(\d+))?$/);
      if (!match) return [];

      const startPeriod = Number(match[2]);
      const endPeriod = Number(match[3] ?? match[2]);

      if (
        !Number.isFinite(startPeriod) ||
        !Number.isFinite(endPeriod) ||
        startPeriod <= 0 ||
        endPeriod <= 0
      ) {
        return [];
      }

      return [
        {
          day: match[1] as LectureDay,
          startPeriod: Math.min(startPeriod, endPeriod),
          endPeriod: Math.max(startPeriod, endPeriod),
        },
      ];
    });
}

export function buildLectureMatchMap(
  courses: LectureTimetableCourse[],
): LectureMatchMap {
  return courses.reduce((map, course) => {
    if (!course.normalizedName) return map;
    map[course.normalizedName] ??= [];
    map[course.normalizedName].push(course);
    return map;
  }, {} as LectureMatchMap);
}

export function getLectureMatches(
  courseName: string,
  matchMap: LectureMatchMap,
  departmentName?: string,
): LectureTimetableCourse[] {
  const matches = matchMap[normalizeCourseName(courseName)] ?? [];
  const normalizedDepartment = departmentName
    ? normalizeDepartmentName(departmentName)
    : "";

  if (!normalizedDepartment) return matches;

  const departmentMatches = matches.filter((match) =>
    normalizeDepartmentName(match.departmentName ?? "").includes(
      normalizedDepartment,
    ),
  );

  return departmentMatches.length > 0 ? departmentMatches : matches;
}

export function getBestLectureCredit(
  courseName: string,
  matchMap: LectureMatchMap,
  departmentName?: string,
): number | null {
  const match = getLectureMatches(courseName, matchMap, departmentName).find(
    (item) => item.credits != null,
  );
  return match?.credits ?? null;
}

function normalizeLectureRow(
  row: unknown,
  index: number,
  metadata: { year?: string; semester?: string },
): LectureTimetableCourse | null {
  if (!isRecord(row)) return null;

  const courseName = stringValue(row["과목명"] ?? row.courseName ?? row.name);
  if (!courseName) return null;

  const courseCode = stringValue(row["과목코드"] ?? row.courseCode);
  const lectureNumber = stringValue(row["강좌번호"] ?? row.lectureNumber);
  const classTime = stringValue(row["수업시간"] ?? row.classTime);

  return {
    id:
      lectureNumber ||
      [courseCode, courseName, row["학부(과)"], row["교수명"], index]
        .filter(Boolean)
        .join("-"),
    courseCode,
    courseName,
    normalizedName: normalizeCourseName(courseName),
    departmentName: stringValue(row["학부(과)"] ?? row.departmentName),
    collegeName: stringValue(row["단과대학"] ?? row.collegeName),
    grade: numberValue(row["학년"] ?? row.grade) ?? undefined,
    completionType: stringValue(row["이수구분"] ?? row.completionType),
    areaType: stringValue(row["영역구분"] ?? row.areaType),
    credits: numberValue(row["학점"] ?? row.credits),
    professor: stringValue(row["교수명"] ?? row.professor),
    classTime,
    timeSlots: parseLectureTimeSlots(classTime),
    place: stringValue(row["장소"] ?? row.place),
    note: stringValue(row["비고"] ?? row.note),
    teamTeaching: stringValue(row["팀티칭여부"] ?? row.teamTeaching),
    semesterLabel: metadata.semester,
    sourceYear: metadata.year,
  };
}

function normalizeDepartmentName(name: string): string {
  return name.normalize("NFKC").replace(/\s/g, "").trim();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number") return String(value);
  return undefined;
}

function numberValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  if (!normalized) return null;

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
