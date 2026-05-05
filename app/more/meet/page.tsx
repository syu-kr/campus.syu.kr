"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { Icon } from "@/app/components/Icon";

const today = new Date().toISOString().slice(0, 10);
const MAX_DATE_COUNT = 14;

export default function MeetCreatePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dateStart, setDateStart] = useState(today);
  const [dateEnd, setDateEnd] = useState(today);
  const [timeStart, setTimeStart] = useState("09:00");
  const [timeEnd, setTimeEnd] = useState("22:00");
  const [slotMinutes, setSlotMinutes] = useState(30);
  const [inviteUrl, setInviteUrl] = useState("");
  const [roomId, setRoomId] = useState("");
  const [error, setError] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mode, setMode] = useState<"join" | "create">("join");

  const rangeValidation = useMemo(
    () => validateMeetRange(dateStart, dateEnd, timeStart, timeEnd),
    [dateEnd, dateStart, timeEnd, timeStart],
  );
  const canSubmit = useMemo(
    () => title.trim().length > 0 && rangeValidation.isValid && !isSubmitting,
    [title, rangeValidation.isValid, isSubmitting],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setCopied(false);

    if (!rangeValidation.isValid) {
      setError("날짜와 시간 범위를 확인해주세요.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/meet/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
          dateStart,
          dateEnd,
          timeStart,
          timeEnd,
          slotMinutes,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "방을 만들지 못했습니다");
      }

      setInviteUrl(data.inviteUrl);
      setRoomId(data.roomId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "방을 만들지 못했습니다");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setJoinError("");

    const roomId = extractRoomId(joinCode);
    if (!roomId) {
      setJoinError("초대 링크 또는 코드를 입력해주세요.");
      return;
    }

    router.push(`/more/meet/${roomId}`);
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;

    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
  };

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <Link
          href="/more"
          className="inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900 mb-4"
        >
          <Icon name="chevron-right" size={16} className="rotate-180" />
          더보기
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          일정 잡기
        </h1>
        <p className="text-neutral-600">
          받은 링크로 참여하거나, 새 모임을 만들어 24시간 동안 의견을 받아보세요.
        </p>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-1">
        <button
          type="button"
          onClick={() => setMode("join")}
          className={`rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
            mode === "join"
              ? "bg-white text-primary-700 shadow-sm"
              : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          초대 코드로 참여
        </button>
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`rounded-lg px-4 py-3 text-sm font-semibold transition-colors ${
            mode === "create"
              ? "bg-white text-primary-700 shadow-sm"
              : "text-neutral-600 hover:text-neutral-900"
          }`}
        >
          새 방 만들기
        </button>
      </div>

      {mode === "join" && (
        <div className="grid grid-cols-1 gap-4">
          <Card hover={false}>
            <form onSubmit={handleJoin} className="space-y-4">
              <div>
                <label
                  htmlFor="join-code"
                  className="block text-sm font-semibold text-neutral-900 mb-2"
                >
                  초대 링크 또는 코드
                </label>
                <input
                  id="join-code"
                  type="text"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value)}
                  placeholder="https://campus.syu.kr/more/meet/abc... 또는 abc..."
                  className="w-full rounded-lg border border-neutral-300 px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              {joinError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {joinError}
                </p>
              )}
              <button
                type="submit"
                className="w-full rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700"
              >
                방에 참여하기
              </button>
            </form>
          </Card>

          <Card className="bg-neutral-50 border border-neutral-200" hover={false}>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">
              참여 방법
            </h2>
            <div className="space-y-2 text-sm text-neutral-700">
              <p>모임을 만든 사람이 보내준 링크를 붙여넣으면 바로 들어갈 수 있습니다.</p>
              <p>링크 대신 짧은 초대 코드만 받아도 참여할 수 있습니다.</p>
            </div>
          </Card>
        </div>
      )}

      {mode === "create" && (
        <div className="grid grid-cols-1 gap-6">
          <Card hover={false}>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  htmlFor="meet-title"
                  className="block text-sm font-semibold text-neutral-900 mb-2"
                >
                  방 제목
                </label>
                <input
                  id="meet-title"
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={80}
                  placeholder="팀플 회의 시간 정하기"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label
                  htmlFor="meet-description"
                  className="block text-sm font-semibold text-neutral-900 mb-2"
                >
                  설명
                </label>
                <textarea
                  id="meet-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={300}
                  rows={3}
                  placeholder="가능한 시간을 모두 선택해주세요."
                  className="w-full resize-none rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="date-start"
                  className="block text-sm font-semibold text-neutral-900 mb-2"
                >
                  시작 날짜
                </label>
                <input
                  id="date-start"
                  type="date"
                  value={dateStart}
                  onChange={(event) => setDateStart(event.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label
                  htmlFor="date-end"
                  className="block text-sm font-semibold text-neutral-900 mb-2"
                >
                  종료 날짜
                </label>
                <input
                  id="date-end"
                  type="date"
                  value={dateEnd}
                  onChange={(event) => setDateEnd(event.target.value)}
                  min={dateStart}
                  max={addDays(dateStart, MAX_DATE_COUNT - 1)}
                  aria-invalid={Boolean(rangeValidation.dateError)}
                  aria-describedby={
                    rangeValidation.dateError ? "date-range-error" : undefined
                  }
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    rangeValidation.dateError
                      ? "border-red-300"
                      : "border-neutral-300"
                  }`}
                />
                {rangeValidation.dateError && (
                  <p id="date-range-error" className="mt-1 text-xs text-red-600">
                    {rangeValidation.dateError}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="time-start"
                  className="block text-sm font-semibold text-neutral-900 mb-2"
                >
                  시작 시간
                </label>
                <input
                  id="time-start"
                  type="time"
                  value={timeStart}
                  onChange={(event) => setTimeStart(event.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label
                  htmlFor="time-end"
                  className="block text-sm font-semibold text-neutral-900 mb-2"
                >
                  종료 시간
                </label>
                <input
                  id="time-end"
                  type="time"
                  value={timeEnd}
                  onChange={(event) => setTimeEnd(event.target.value)}
                  aria-invalid={Boolean(rangeValidation.timeError)}
                  aria-describedby={
                    rangeValidation.timeError ? "time-range-error" : undefined
                  }
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    rangeValidation.timeError
                      ? "border-red-300"
                      : "border-neutral-300"
                  }`}
                />
                {rangeValidation.timeError && (
                  <p id="time-range-error" className="mt-1 text-xs text-red-600">
                    {rangeValidation.timeError}
                  </p>
                )}
              </div>
            </div>

            <div>
              <label
                htmlFor="slot-minutes"
                className="block text-sm font-semibold text-neutral-900 mb-2"
              >
                시간 간격
              </label>
              <select
                id="slot-minutes"
                value={slotMinutes}
                onChange={(event) => setSlotMinutes(Number(event.target.value))}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value={15}>15분</option>
                <option value={30}>30분</option>
                <option value={60}>60분</option>
              </select>
            </div>

            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {isSubmitting ? "방 만드는 중..." : "초대 링크 만들기"}
            </button>
            </form>
          </Card>

          <Card className="bg-neutral-50 border border-neutral-200" hover={false}>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">
              이렇게 진행돼요
            </h2>
            <div className="space-y-3 text-sm text-neutral-700">
              <p>모임 이름과 가능한 날짜, 시간을 정하면 공유 링크가 만들어집니다.</p>
              <p>사람들은 링크에서 이름을 입력하고 가능한 시간만 체크하면 됩니다.</p>
              <p>응답은 방을 만든 뒤 24시간 동안만 받고, 이후에는 결과만 볼 수 있습니다.</p>
              <p>모두가 체크한 뒤 가장 많이 겹치는 시간을 바로 확인할 수 있습니다.</p>
            </div>
          </Card>

          {inviteUrl && (
            <Card className="border border-green-200 bg-green-50" hover={false}>
              <h2 className="text-base font-semibold text-neutral-900 mb-3">
                초대 링크
              </h2>
              <p className="break-all rounded-lg bg-white p-3 text-sm text-neutral-800 border border-green-200">
                {inviteUrl}
              </p>
              <div className="mt-3 grid grid-cols-1 gap-2">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
                >
                  {copied ? "복사됨" : "링크 복사"}
                </button>
                <Link
                  href={`/more/meet/${roomId}`}
                  className="rounded-lg border border-green-300 bg-white px-4 py-2 text-center text-sm font-semibold text-green-800 hover:border-green-500"
                >
                  방으로 이동
                </Link>
              </div>
            </Card>
          )}
        </div>
      )}
    </Container>
  );
}

function extractRoomId(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    return sanitizeRoomId(parts[parts.length - 1] || "");
  } catch {
    const withoutTrailingSlash = trimmed.replace(/\/+$/, "");
    const parts = withoutTrailingSlash.split("/").filter(Boolean);
    return sanitizeRoomId(parts[parts.length - 1] || withoutTrailingSlash);
  }
}

function sanitizeRoomId(value: string): string {
  return value.trim().replace(/[^A-Za-z0-9_-]/g, "");
}

function validateMeetRange(
  dateStart: string,
  dateEnd: string,
  timeStart: string,
  timeEnd: string,
) {
  const dateCount = getDateCount(dateStart, dateEnd);
  const startMinutes = parseTimeToMinutes(timeStart);
  const endMinutes = parseTimeToMinutes(timeEnd);
  const dateError =
    dateCount < 1
      ? "종료 날짜는 시작 날짜보다 빠를 수 없습니다."
      : dateCount > MAX_DATE_COUNT
        ? `날짜 범위는 최대 ${MAX_DATE_COUNT}일까지 가능합니다.`
        : "";
  const timeError =
    endMinutes <= startMinutes
      ? "종료 시간은 시작 시간보다 늦어야 합니다."
      : "";

  return {
    dateError,
    timeError,
    isValid: !dateError && !timeError,
  };
}

function getDateCount(dateStart: string, dateEnd: string): number {
  const start = parseDateAsUtc(dateStart).getTime();
  const end = parseDateAsUtc(dateEnd).getTime();
  return Math.floor((end - start) / 86400000) + 1;
}

function parseDateAsUtc(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function parseTimeToMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

function addDays(date: string, days: number): string {
  const base = parseDateAsUtc(date);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}
