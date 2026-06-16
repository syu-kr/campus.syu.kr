const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const MAX_DATE_COUNT = 14;

const ALLOWED_MEET_SLOT_MINUTES = [15, 30, 60] as const;

export interface MeetRoomInput {
  title: string;
  description: string;
  dateStart: string;
  dateEnd: string;
  timeStart: string;
  timeEnd: string;
  slotMinutes: number;
}

export function normalizeMeetRoomInput(input: unknown): MeetRoomInput {
  if (!input || typeof input !== "object") {
    throw new Error("요청 본문이 올바르지 않습니다");
  }

  const body = input as Record<string, unknown>;
  const title = String(body.title || "").trim();
  const description = String(body.description || "").trim();
  const dateStart = String(body.dateStart || body.date_start || "").trim();
  const dateEnd = String(body.dateEnd || body.date_end || "").trim();
  const timeStart = String(body.timeStart || body.time_start || "").trim();
  const timeEnd = String(body.timeEnd || body.time_end || "").trim();
  const slotMinutes = Number(body.slotMinutes ?? body.slot_minutes ?? 30);

  if (!title || title.length > 80) {
    throw new Error("방 제목은 1자 이상 80자 이하로 입력해주세요");
  }

  if (description.length > 300) {
    throw new Error("설명은 300자 이하로 입력해주세요");
  }

  assertValidMeetRange({ dateStart, dateEnd, timeStart, timeEnd, slotMinutes });

  return {
    title,
    description,
    dateStart,
    dateEnd,
    timeStart,
    timeEnd,
    slotMinutes,
  };
}

function assertValidMeetRange({
  dateStart,
  dateEnd,
  timeStart,
  timeEnd,
  slotMinutes,
}: Omit<MeetRoomInput, "title" | "description">) {
  if (!isValidDateString(dateStart) || !isValidDateString(dateEnd)) {
    throw new Error("날짜 형식이 올바르지 않습니다");
  }

  if (!TIME_PATTERN.test(timeStart) || !TIME_PATTERN.test(timeEnd)) {
    throw new Error("시간 형식이 올바르지 않습니다");
  }

  if (
    !Number.isInteger(slotMinutes) ||
    !ALLOWED_MEET_SLOT_MINUTES.includes(slotMinutes as 15 | 30 | 60)
  ) {
    throw new Error("시간 간격은 15분, 30분, 60분 중 하나여야 합니다");
  }

  const dateCount = getDateCount(dateStart, dateEnd);
  if (dateCount < 1) {
    throw new Error("종료 날짜는 시작 날짜보다 빠를 수 없습니다");
  }

  if (dateCount > MAX_DATE_COUNT) {
    throw new Error(`날짜 범위는 최대 ${MAX_DATE_COUNT}일까지 가능합니다`);
  }

  const startMinutes = parseTimeToMinutes(timeStart);
  const endMinutes = parseTimeToMinutes(timeEnd);
  const dailyMinutes = endMinutes - startMinutes;

  if (dailyMinutes <= 0) {
    throw new Error("종료 시간은 시작 시간보다 늦어야 합니다");
  }
}

export function buildMeetSlots({
  dateStart,
  dateEnd,
  timeStart,
  timeEnd,
  slotMinutes,
}: Omit<MeetRoomInput, "title" | "description">): string[] {
  assertValidMeetRange({ dateStart, dateEnd, timeStart, timeEnd, slotMinutes });

  const slots: string[] = [];
  const startMinutes = parseTimeToMinutes(timeStart);
  const endMinutes = parseTimeToMinutes(timeEnd);

  for (const date of eachDate(dateStart, dateEnd)) {
    for (
      let minute = startMinutes;
      minute < endMinutes;
      minute += slotMinutes
    ) {
      slots.push(`${date}T${formatMinutes(minute)}:00+09:00`);
    }
  }

  return slots;
}

export function filterValidAvailability(
  availability: unknown,
  slots: string[],
): string[] {
  if (!Array.isArray(availability)) {
    return [];
  }

  const validSlots = new Set(slots);
  const deduped = new Set<string>();

  for (const slot of availability) {
    if (typeof slot === "string" && validSlots.has(slot)) {
      deduped.add(slot);
    }
  }

  return Array.from(deduped).sort();
}

export function getMeetDatesFromSlots(slots: string[]): string[] {
  return Array.from(new Set(slots.map((slot) => slot.slice(0, 10))));
}

export function getMeetTimesFromSlots(slots: string[]): string[] {
  return Array.from(new Set(slots.map((slot) => slot.slice(11, 16))));
}

function parseTimeToMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function isValidDateString(date: string): boolean {
  if (!DATE_PATTERN.test(date)) return false;

  return parseDateAsUtc(date).toISOString().slice(0, 10) === date;
}

function formatMinutes(totalMinutes: number): string {
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function getDateCount(dateStart: string, dateEnd: string): number {
  const start = parseDateAsUtc(dateStart).getTime();
  const end = parseDateAsUtc(dateEnd).getTime();
  return Math.floor((end - start) / 86400000) + 1;
}

function eachDate(dateStart: string, dateEnd: string): string[] {
  const dates: string[] = [];
  const start = parseDateAsUtc(dateStart);
  const count = getDateCount(dateStart, dateEnd);

  for (let index = 0; index < count; index++) {
    const current = new Date(start.getTime() + index * 86400000);
    dates.push(current.toISOString().slice(0, 10));
  }

  return dates;
}

function parseDateAsUtc(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}
