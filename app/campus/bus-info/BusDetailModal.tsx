"use client";

import { BusArrival } from "@/types";
import { useEffect } from "react";
import clsx from "clsx";

interface BusDetailModalProps {
  bus: BusArrival | null;
  direction: "up" | "down" | null;
  stopId: string | undefined;
  isOpen: boolean;
  onClose: () => void;
}

function getSeatStatus(crowded: number | undefined): {
  label: string;
  color: string;
} {
  if (crowded === undefined || crowded < 0) {
    return { label: "정보 없음", color: "bg-gray-100 text-gray-700" };
  }

  switch (crowded) {
    case 0:
      return { label: "여유", color: "bg-green-100 text-green-700" };
    case 1:
      return { label: "보통", color: "bg-yellow-100 text-yellow-700" };
    case 2:
      return { label: "혼잡", color: "bg-red-100 text-red-700" };
    default:
      return { label: "정보 없음", color: "bg-gray-100 text-gray-700" };
  }
}

export default function BusDetailModal({
  bus,
  direction,
  stopId,
  isOpen,
  onClose,
}: BusDetailModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen || !bus) return null;

  const seatStatus1 = getSeatStatus(bus.crowded1);
  const seatStatus2 = getSeatStatus(bus.crowded2);

  return (
    <>
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-40"
        onClick={onClose}
      />

      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:w-full max-w-md max-h-[80vh] overflow-y-auto shadow-2xl">
          <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{bus.routeName}</h2>
              <p className="text-blue-100 text-sm mt-1">
                {stopId?.includes("jungmun") && direction === "up"
                  ? "담터고개 행"
                  : stopId?.includes("jungmun") && direction === "down"
                    ? "태릉국제스케이트장 행"
                    : stopId?.includes("humun") && direction === "up"
                      ? "미리내마을4-2단지.한별초등학교 행"
                      : stopId?.includes("humun") && direction === "down"
                        ? "태릉국제스케이트장 행"
                        : "목적지"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-blue-700 rounded-full p-2 transition"
            >
              ×
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <h3 className="font-bold text-lg text-neutral-900">현재 버스</h3>

              {!bus.predictTime1 || bus.predictTime1 <= 0 ? (
                <div className="bg-gray-50 rounded-lg p-4 text-center text-neutral-500">
                  도착 예정 정보 없음
                </div>
              ) : (
                <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-600">도착까지</span>
                    <div className="flex items-baseline gap-2">
                      {bus.locationNo1 && bus.locationNo1 > 0 && (
                        <span className="text-neutral-700">
                          {bus.locationNo1}정거장 전 |
                        </span>
                      )}
                      <span className="text-xl font-bold text-blue-600">
                        {Math.ceil(bus.predictTime1 || 0)}분
                      </span>
                    </div>
                  </div>

                  {bus.nextStation1 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">다음 정류소</span>
                      <span className="font-medium text-neutral-900">
                        {bus.nextStation1}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-neutral-600">버스 타입</span>
                    <span>
                      {bus.isLow1 ? (
                        <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                          저상버스
                        </span>
                      ) : (
                        <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">
                          일반버스
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-neutral-600">좌석 현황</span>
                    <span
                      className={clsx(
                        "px-3 py-1 rounded-full text-sm font-medium",
                        seatStatus1.color,
                      )}
                    >
                      {seatStatus1.label}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {bus.predictTime2 &&
              bus.predictTime2 > 0 &&
              bus.predictTime2 < Infinity && (
                <div className="space-y-4">
                  <h3 className="font-bold text-lg text-neutral-900">
                    다음 버스
                  </h3>

                  <div className="bg-neutral-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-600">도착까지</span>
                      <div className="flex items-baseline gap-2">
                        {bus.locationNo2 && bus.locationNo2 > 0 && (
                          <span className="text-neutral-700">
                            {bus.locationNo2}정거장 전 |
                          </span>
                        )}
                        <span className="text-xl font-bold text-neutral-700">
                          {Math.ceil(bus.predictTime2 || 0)}분
                        </span>
                      </div>
                    </div>

                    {bus.nextStation2 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-neutral-600">다음 정류소</span>
                        <span className="font-medium text-neutral-900">
                          {bus.nextStation2}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-neutral-600">버스 타입</span>
                      <span>
                        {bus.isLow2 ? (
                          <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                            저상버스
                          </span>
                        ) : (
                          <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">
                            일반버스
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-neutral-600">좌석 현황</span>
                      <span
                        className={clsx(
                          "px-3 py-1 rounded-full text-sm font-medium",
                          seatStatus2.color,
                        )}
                      >
                        {seatStatus2.label}
                      </span>
                    </div>
                  </div>
                </div>
              )}

            <button
              onClick={onClose}
              className="w-full bg-gray-200 hover:bg-gray-300 text-gray-900 font-medium py-3 rounded-lg transition"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
