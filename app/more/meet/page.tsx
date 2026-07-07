"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { Icon } from "@/app/components/Icon";
import {
  useDictionary,
  useLocale,
} from "@/app/components/LocaleProvider";
import { localizePath, type Dictionary, type Locale } from "@/lib/i18n";

const MAX_DATE_COUNT = 14;

type MeetDictionary = Dictionary["pages"]["meet"];
type MeetErrors = MeetDictionary["errors"];

const meetErrorKeys: Record<string, keyof MeetErrors> = {
  "요청 본문이 올바르지 않습니다": "invalidBody",
  "방 제목은 1자 이상 80자 이하로 입력해주세요": "titleInvalid",
  "설명은 300자 이하로 입력해주세요": "descriptionTooLong",
  "날짜 형식이 올바르지 않습니다": "invalidDateFormat",
  "시간 형식이 올바르지 않습니다": "invalidTimeFormat",
  "시간 간격은 15분, 30분, 60분 중 하나여야 합니다":
    "invalidSlotMinutes",
  "종료 날짜는 시작 날짜보다 빠를 수 없습니다": "endDateBeforeStart",
  "종료 시간은 시작 시간보다 늦어야 합니다": "endTimeAfterStart",
  "초대 코드를 생성하지 못했습니다. 다시 시도해주세요": "inviteCodeFailed",
  "방을 만들 수 없습니다": "createFailed",
  "방을 만들지 못했습니다": "createFailed",
  "Content-Type은 application/json이어야 합니다.": "contentType",
  "요청 본문이 너무 큽니다.": "requestTooLarge",
  "JSON 요청 본문이 올바르지 않습니다.": "invalidJson",
  "허용되지 않은 출처의 요청입니다.": "forbiddenOrigin",
  "요청 제한 설정이 완료되지 않았습니다.": "rateLimitConfig",
};

export default function MeetCreatePage() {
  const router = useRouter();
  const dictionary = useDictionary();
  const locale = useLocale();
  const text = dictionary.pages.meet;
  const [initialDate] = useState(() => formatKoreaDateInput());
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dateStart, setDateStart] = useState(initialDate);
  const [dateEnd, setDateEnd] = useState(initialDate);
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
  const [copyError, setCopyError] = useState("");
  const [mode, setMode] = useState<"join" | "create">("join");

  const rangeValidation = useMemo(
    () => validateMeetRange(dateStart, dateEnd, timeStart, timeEnd, text),
    [dateEnd, dateStart, text, timeEnd, timeStart],
  );
  const canSubmit = useMemo(
    () => title.trim().length > 0 && rangeValidation.isValid && !isSubmitting,
    [title, rangeValidation.isValid, isSubmitting],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setCopied(false);
    setCopyError("");

    if (!rangeValidation.isValid) {
      setError(text.rangeInvalid);
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
        throw new Error(getMeetErrorMessage(data.error, text));
      }

      setInviteUrl(localizeInviteUrl(data.inviteUrl, locale));
      setRoomId(data.roomId);
    } catch (err) {
      setError(err instanceof Error ? err.message : text.createFailed);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setJoinError("");

    const roomId = extractRoomId(joinCode);
    if (!roomId) {
      setJoinError(text.joinRequired);
      return;
    }

    router.push(localizePath(`/more/meet/${roomId}`, locale));
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;

    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setCopyError("");
    } catch {
      setCopied(false);
      setCopyError(text.copyFailed);
    }
  };

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <Link
          href={localizePath("/more", locale)}
          className="inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900 mb-4"
        >
          <Icon name="chevron-right" size={16} className="rotate-180" />
          {text.backToMore}
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          {text.title}
        </h1>
        <p className="text-neutral-600">{text.description}</p>
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
          {text.joinMode}
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
          {text.createMode}
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
                  {text.joinCodeLabel}
                </label>
                <input
                  id="join-code"
                  type="text"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value)}
                  placeholder={text.joinCodePlaceholder}
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
                {text.joinAction}
              </button>
            </form>
          </Card>

          <Card className="bg-neutral-50 border border-neutral-200" hover={false}>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">
              {text.joinHelpTitle}
            </h2>
            <div className="space-y-2 text-sm text-neutral-700">
              {text.joinHelpItems.map((item) => (
                <p key={item}>{item}</p>
              ))}
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
                  {text.titleLabel}
                </label>
                <input
                  id="meet-title"
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={80}
                  placeholder={text.titlePlaceholder}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label
                  htmlFor="meet-description"
                  className="block text-sm font-semibold text-neutral-900 mb-2"
                >
                  {text.descriptionLabel}
                </label>
                <textarea
                  id="meet-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={300}
                  rows={3}
                  placeholder={text.descriptionPlaceholder}
                  className="w-full resize-none rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="date-start"
                    className="block text-sm font-semibold text-neutral-900 mb-2"
                  >
                    {text.startDate}
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
                    {text.endDate}
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
                    <p
                      id="date-range-error"
                      className="mt-1 text-xs text-red-600"
                    >
                      {rangeValidation.dateError}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    htmlFor="time-start"
                    className="block text-sm font-semibold text-neutral-900 mb-2"
                  >
                    {text.startTime}
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
                    {text.endTime}
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
                    <p
                      id="time-range-error"
                      className="mt-1 text-xs text-red-600"
                    >
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
                  {text.slotMinutes}
                </label>
                <select
                  id="slot-minutes"
                  value={slotMinutes}
                  onChange={(event) => setSlotMinutes(Number(event.target.value))}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value={15}>15{text.minuteUnit}</option>
                  <option value={30}>30{text.minuteUnit}</option>
                  <option value={60}>60{text.minuteUnit}</option>
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
                {isSubmitting ? text.submitting : text.createInvite}
              </button>
            </form>
          </Card>

          <Card className="bg-neutral-50 border border-neutral-200" hover={false}>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">
              {text.flowTitle}
            </h2>
            <div className="space-y-3 text-sm text-neutral-700">
              {text.flowItems.map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </Card>

          {inviteUrl && (
            <Card className="border border-green-200 bg-green-50" hover={false}>
              <h2 className="text-base font-semibold text-neutral-900 mb-3">
                {text.inviteLinkTitle}
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
                  {copied ? text.copied : text.copyLink}
                </button>
                {copyError && (
                  <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    {copyError}
                  </p>
                )}
                <Link
                  href={localizePath(`/more/meet/${roomId}`, locale)}
                  className="rounded-lg border border-green-300 bg-white px-4 py-2 text-center text-sm font-semibold text-green-800 hover:border-green-500"
                >
                  {text.goToRoom}
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
  text: MeetDictionary,
) {
  const dateCount = getDateCount(dateStart, dateEnd);
  const startMinutes = parseTimeToMinutes(timeStart);
  const endMinutes = parseTimeToMinutes(timeEnd);
  const dateError =
    dateCount < 1
      ? text.endDateBeforeStart
      : dateCount > MAX_DATE_COUNT
        ? text.dateRangeMax.replace("{max}", String(MAX_DATE_COUNT))
        : "";
  const timeError =
    endMinutes <= startMinutes ? text.endTimeAfterStart : "";

  return {
    dateError,
    timeError,
    isValid: !dateError && !timeError,
  };
}

function getMeetErrorMessage(error: unknown, text: MeetDictionary): string {
  if (typeof error !== "string") return text.createFailed;

  const rateLimitSeconds = error.match(/요청이 많습니다\. (\d+)초/)?.[1];
  if (rateLimitSeconds) {
    return text.errors.rateLimited.replace("{seconds}", rateLimitSeconds);
  }

  const dateRangeMax = error.match(/날짜 범위는 최대 (\d+)일까지 가능합니다/)?.[1];
  if (dateRangeMax) {
    return text.errors.dateRangeMax.replace("{max}", dateRangeMax);
  }

  const key = meetErrorKeys[error];
  return key ? text.errors[key] : text.createFailed;
}

function localizeInviteUrl(value: string, locale: Locale): string {
  try {
    const url = new URL(value);
    url.pathname = localizePath(url.pathname, locale);
    return url.toString();
  } catch {
    return localizePath(value, locale);
  }
}

function formatKoreaDateInput(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );

  return `${values.year}-${values.month}-${values.day}`;
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
