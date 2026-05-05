"use client";

import {
  FormEvent,
  PointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { Icon } from "@/app/components/Icon";
import { Modal } from "@/app/components/Modal";
import {
  formatMeetSlot,
  getMeetDatesFromSlots,
  getMeetTimesFromSlots,
} from "@/lib/meet";
import type { MeetParticipant, MeetRoomResponse } from "@/types/meet";
import {
  formatDateLabel,
  formatDateTimeLabel,
  TimeRow,
} from "@/app/features/meet/availability-grid";

interface PageProps {
  params: {
    roomId: string;
  };
}

export default function MeetRoomPage({ params }: PageProps) {
  const [data, setData] = useState<MeetRoomResponse | null>(null);
  const [nickname, setNickname] = useState("");
  const [availability, setAvailability] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dragMode, setDragMode] = useState<boolean | null>(null);
  const [mobileDate, setMobileDate] = useState("");
  const [overwriteConfirmOpen, setOverwriteConfirmOpen] = useState(false);

  const loadRoom = useCallback(async () => {
    setError("");
    setIsLoading(true);

    try {
      const response = await fetch(`/api/meet/rooms/${params.roomId}`, {
        cache: "no-store",
      });
      const roomData = await response.json();

      if (!response.ok) {
        throw new Error(roomData.error || "일정 방을 불러오지 못했습니다");
      }

      setData(roomData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "일정 방을 불러오지 못했습니다",
      );
    } finally {
      setIsLoading(false);
    }
  }, [params.roomId]);

  useEffect(() => {
    void loadRoom();
  }, [loadRoom]);

  useEffect(() => {
    if (!mobileDate && data?.slots.length) {
      setMobileDate(data.slots[0].slice(0, 10));
    }
  }, [data, mobileDate]);

  useEffect(() => {
    if (dragMode === null) return;

    const stopDrag = () => setDragMode(null);
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);

    return () => {
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
    };
  }, [dragMode]);

  const dates = useMemo(
    () => (data ? getMeetDatesFromSlots(data.slots) : []),
    [data],
  );
  const times = useMemo(
    () => (data ? getMeetTimesFromSlots(data.slots) : []),
    [data],
  );
  const slotSet = useMemo(() => new Set(data?.slots || []), [data]);
  const matchedParticipant = useMemo(() => {
    const normalized = nickname.trim();
    if (!normalized || !data) return null;

    return (
      data.participants.find(
        (participant) => participant.nickname === normalized,
      ) || null
    );
  }, [data, nickname]);
  const isClosed = !data?.room.acceptingResponses;
  const selectedCountByDate = useMemo(() => {
    const counts = new Map<string, number>();
    availability.forEach((slot) => {
      const date = slot.slice(0, 10);
      counts.set(date, (counts.get(date) || 0) + 1);
    });
    return counts;
  }, [availability]);

  const bestSlots = useMemo(() => {
    if (!data) return [];

    const counts = new Map<string, number>();
    for (const slot of data.slots) {
      counts.set(slot, 0);
    }

    for (const participant of data.participants) {
      for (const slot of participant.availability) {
        counts.set(slot, (counts.get(slot) || 0) + 1);
      }
    }

    const maxCount = Math.max(0, ...Array.from(counts.values()));
    if (maxCount === 0) return [];

    return Array.from(counts.entries())
      .filter(([, count]) => count === maxCount)
      .slice(0, 6)
      .map(([slot, count]) => ({ slot, count }));
  }, [data]);

  const participantBySlot = useMemo(() => {
    const result = new Map<string, MeetParticipant[]>();
    if (!data) return result;

    for (const participant of data.participants) {
      for (const slot of participant.availability) {
        const participants = result.get(slot) || [];
        participants.push(participant);
        result.set(slot, participants);
      }
    }

    return result;
  }, [data]);

  const handleSlotPointerDown = (
    event: PointerEvent<HTMLButtonElement>,
    slot: string,
  ) => {
    event.preventDefault();
    const nextMode = !availability.has(slot);
    setDragMode(nextMode);
    setSlotValue(slot, nextMode);
  };

  const handleSlotPointerEnter = (slot: string) => {
    if (dragMode === null) return;
    setSlotValue(slot, dragMode);
  };

  const handlePointerEnd = () => {
    setDragMode(null);
  };

  const handleGridPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragMode === null) return;

    const target = document.elementFromPoint(event.clientX, event.clientY);
    const slot = target
      ?.closest<HTMLButtonElement>("button[data-slot]")
      ?.getAttribute("data-slot");

    if (slot) {
      setSlotValue(slot, dragMode);
    }
  };

  const setSlotValue = (slot: string, selected: boolean) => {
    if (!slotSet.has(slot)) return;

    setAvailability((current) => {
      const next = new Set(current);
      if (selected) {
        next.add(slot);
      } else {
        next.delete(slot);
      }
      return next;
    });
  };

  const handleLoadParticipant = () => {
    if (!matchedParticipant) return;
    setAvailability(new Set(matchedParticipant.availability));
    setStatus("기존 선택을 불러왔습니다.");
  };

  const saveAvailability = async () => {
    setError("");
    setStatus("");

    if (isClosed) {
      setError("이 일정 방은 응답 시간이 마감되어 결과만 볼 수 있습니다.");
      return;
    }

    if (availability.size === 0) {
      setError("가능한 시간을 1개 이상 선택한 뒤 저장해주세요.");
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch(
        `/api/meet/rooms/${params.roomId}/participants`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            nickname,
            availability: Array.from(availability),
          }),
        },
      );
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "참여 정보를 저장하지 못했습니다");
      }

      setStatus("가능한 시간이 저장되었습니다.");
      await loadRoom();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "참여 정보를 저장하지 못했습니다",
      );
    } finally {
      setIsSaving(false);
      setOverwriteConfirmOpen(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (matchedParticipant) {
      setOverwriteConfirmOpen(true);
      return;
    }

    await saveAvailability();
  };

  if (isLoading) {
    return (
      <Container className="py-6 sm:py-8">
        <Card hover={false}>
          <p className="text-sm text-neutral-600">일정 방을 불러오는 중...</p>
        </Card>
      </Container>
    );
  }

  if (!data) {
    return (
      <Container className="py-6 sm:py-8">
        <Card className="border border-red-200 bg-red-50" hover={false}>
          <p className="text-sm text-red-700">
            {error || "일정 방을 찾을 수 없습니다."}
          </p>
          <Link
            href="/more/meet"
            className="mt-4 inline-block rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
          >
            새 방 만들기
          </Link>
        </Card>
      </Container>
    );
  }

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-6">
        <Link
          href="/more/meet"
          className="inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900 mb-4"
        >
          <Icon name="chevron-right" size={16} className="rotate-180" />
          일정 잡기
        </Link>
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          {data.room.title}
        </h1>
        {data.room.description && (
          <p className="text-neutral-600">{data.room.description}</p>
        )}
        <div
          className={`mt-4 rounded-lg border px-3 py-2 text-sm ${
            data.room.acceptingResponses
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-neutral-200 bg-neutral-100 text-neutral-700"
          }`}
        >
          {data.room.acceptingResponses
            ? `응답 가능: ${formatDateTimeLabel(data.room.responseClosesAt)}까지`
            : "응답 시간이 마감되어 결과만 볼 수 있습니다."}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <form onSubmit={handleSubmit} className="min-w-0 space-y-4">
          {!isClosed && (
            <Card hover={false}>
            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3 sm:items-end">
              <div>
                <label
                  htmlFor="nickname"
                  className="block text-sm font-semibold text-neutral-900 mb-2"
                >
                  닉네임
                </label>
                <input
                  id="nickname"
                  type="text"
                  value={nickname}
                  onChange={(event) => setNickname(event.target.value)}
                  maxLength={30}
                  placeholder="이름을 입력하세요"
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <button
                type="button"
                onClick={handleLoadParticipant}
                disabled={!matchedParticipant}
                className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-800 hover:border-primary-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                기존 선택 불러오기
              </button>
            </div>
            {matchedParticipant && (
              <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                같은 닉네임의 기존 응답이 있습니다. 저장하면 이 닉네임의
                선택이 새 내용으로 바뀝니다. 새 응답으로 저장하려면 닉네임을
                다르게 입력하세요.
              </p>
            )}
            </Card>
          )}

          <Card hover={false} className="p-0 overflow-hidden">
            <div className="border-b border-neutral-200 px-4 py-3">
              <h2 className="text-base font-semibold text-neutral-900">
                {isClosed ? "결과 보기" : "가능한 시간 선택"}
              </h2>
              <p className="text-sm text-neutral-600 mt-1">
                {isClosed
                  ? "응답이 마감되어 더 이상 수정할 수 없습니다."
                  : "칸을 누르거나 드래그해서 가능한 시간을 표시하세요."}
              </p>
            </div>

            <div
              className="hidden overflow-x-auto sm:block"
              onPointerMove={handleGridPointerMove}
              onPointerUp={handlePointerEnd}
              onPointerLeave={handlePointerEnd}
            >
              <div
                className="grid min-w-[640px] touch-none select-none"
                style={{
                  gridTemplateColumns: `72px repeat(${dates.length}, minmax(76px, 1fr))`,
                }}
              >
                <div className="sticky left-0 z-10 bg-neutral-100 border-b border-r border-neutral-200 p-2 text-xs font-semibold text-neutral-600">
                  시간
                </div>
                {dates.map((date) => (
                  <div
                    key={date}
                    className="border-b border-r border-neutral-200 bg-neutral-100 p-2 text-center text-xs font-semibold text-neutral-800"
                  >
                    {formatDateLabel(date)}
                  </div>
                ))}

                {times.map((time) => (
                  <TimeRow
                    key={time}
                    time={time}
                    dates={dates}
                    availability={availability}
                    participantBySlot={participantBySlot}
                    readOnly={isClosed}
                    onPointerDown={handleSlotPointerDown}
                    onPointerEnter={handleSlotPointerEnter}
                  />
                ))}
              </div>
            </div>

            <div className="sm:hidden">
              <div className="border-b border-neutral-200 bg-neutral-50 p-3">
                <label
                  htmlFor="mobile-date"
                  className="block text-xs font-semibold text-neutral-700 mb-2"
                >
                  날짜
                </label>
                <select
                  id="mobile-date"
                  value={mobileDate || dates[0] || ""}
                  onChange={(event) => setMobileDate(event.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {dates.map((date) => (
                    <option key={date} value={date}>
                      {formatDateLabel(date)}
                    </option>
                  ))}
                </select>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  {dates.map((date) => (
                    <span
                      key={date}
                      className="rounded-full bg-white px-2 py-1 text-neutral-700 ring-1 ring-neutral-200"
                    >
                      {formatDateLabel(date)} {selectedCountByDate.get(date) || 0}
                      칸
                    </span>
                  ))}
                </div>
              </div>

              <div
                className="grid touch-none select-none"
                style={{
                  gridTemplateColumns: "72px minmax(0, 1fr)",
                }}
                onPointerMove={handleGridPointerMove}
                onPointerUp={handlePointerEnd}
                onPointerLeave={handlePointerEnd}
              >
                <div className="bg-neutral-100 border-b border-r border-neutral-200 p-2 text-xs font-semibold text-neutral-600">
                  시간
                </div>
                <div className="border-b border-neutral-200 bg-neutral-100 p-2 text-center text-xs font-semibold text-neutral-800">
                  {formatDateLabel(mobileDate || dates[0] || "")}
                </div>
                {times.map((time) => (
                  <TimeRow
                    key={time}
                    time={time}
                    dates={[mobileDate || dates[0] || ""]}
                    availability={availability}
                    participantBySlot={participantBySlot}
                    compact
                    readOnly={isClosed}
                    onPointerDown={handleSlotPointerDown}
                    onPointerEnter={handleSlotPointerEnter}
                  />
                ))}
              </div>
            </div>
          </Card>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          {status && (
            <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              {status}
            </p>
          )}

          {!isClosed && (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700">
              선택한 가능 시간: {availability.size}칸
            </div>
          )}

          {!isClosed && (
            <button
              type="submit"
              disabled={isSaving || !nickname.trim()}
              className="w-full rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-neutral-300"
            >
              {isSaving
                ? "저장 중..."
                : matchedParticipant
                  ? "기존 응답 덮어쓰기"
                  : "내 가능 시간 저장"}
            </button>
          )}
        </form>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Card hover={false}>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">
              가장 많이 겹치는 시간
            </h2>
            {bestSlots.length > 0 ? (
              <div className="space-y-2">
                {bestSlots.map(({ slot, count }) => (
                  <div
                    key={slot}
                    className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2"
                  >
                    <p className="text-sm font-semibold text-blue-900">
                      {formatMeetSlot(slot)}
                    </p>
                    <p className="text-xs text-blue-700">{count}명 가능</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-600">
                아직 선택된 시간이 없습니다.
              </p>
            )}
          </Card>

          <Card hover={false}>
            <h2 className="text-base font-semibold text-neutral-900 mb-3">
              참여자 {data.participants.length}명
            </h2>
            {data.participants.length > 0 ? (
              <div className="space-y-2">
                {data.participants.map((participant) => (
                  <div
                    key={participant.nickname}
                    className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2"
                  >
                    <span className="text-sm font-medium text-neutral-900">
                      {participant.nickname}
                    </span>
                    <span className="text-xs text-neutral-500">
                      {participant.availability.length}칸
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-600">
                초대 링크를 공유해 참여를 받아보세요.
              </p>
            )}
          </Card>
        </div>
      </div>

      <Modal
        isOpen={overwriteConfirmOpen}
        title="기존 응답을 덮어쓸까요?"
        description="같은 닉네임으로 저장된 응답이 있습니다."
        onClose={() => setOverwriteConfirmOpen(false)}
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm leading-6 text-neutral-600">
            계속하면 이 닉네임의 기존 가능 시간이 현재 선택한 {availability.size}
            칸으로 바뀝니다. 새 응답으로 남기려면 닉네임을 다르게 입력하세요.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setOverwriteConfirmOpen(false)}
              className="rounded-lg border border-neutral-300 px-4 py-2.5 text-sm font-semibold text-neutral-700 hover:bg-neutral-50"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => void saveAvailability()}
              className="rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
            >
              덮어쓰기
            </button>
          </div>
        </div>
      </Modal>
    </Container>
  );
}
