"use client";

import { BusArrival } from "@/types";
import { useEffect, useRef } from "react";
import clsx from "clsx";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import type { Dictionary } from "@/lib/i18n";

type BusInfoDictionary = Dictionary["pages"]["busInfo"];

interface BusDetailModalProps {
  bus: BusArrival | null;
  direction: "up" | "down" | null;
  stopId: string | undefined;
  isOpen: boolean;
  onClose: () => void;
}

function getSeatStatus(
  crowded: number | undefined,
  text: BusInfoDictionary,
): {
  label: string;
  color: string;
} {
  if (crowded === undefined || crowded < 0) {
    return { label: text.noInfo, color: "bg-gray-100 text-gray-700" };
  }

  switch (crowded) {
    case 0:
      return { label: text.relaxed, color: "bg-green-100 text-green-700" };
    case 1:
      return { label: text.normal, color: "bg-yellow-100 text-yellow-700" };
    case 2:
      return { label: text.crowded, color: "bg-red-100 text-red-700" };
    default:
      return { label: text.noInfo, color: "bg-gray-100 text-gray-700" };
  }
}

export default function BusDetailModal({
  bus,
  direction,
  stopId,
  isOpen,
  onClose,
}: BusDetailModalProps) {
  const dictionary = useDictionary();
  const locale = useLocale();
  const text = dictionary.pages.busInfo;
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !bus) return null;

  const seatStatus1 = getSeatStatus(bus.crowded1, text);
  const seatStatus2 = getSeatStatus(bus.crowded2, text);
  const destination = getDestinationLabel(stopId, direction, text);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`${bus.routeName} ${text.busDetailLabel}`}
    >
      <div
        className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
          <div className="sticky top-0 bg-white text-neutral-900 px-6 py-4 flex items-center justify-between border-b border-neutral-200">
            <div>
              <h2 className="text-2xl font-bold">{bus.routeName}</h2>
              <p className="text-neutral-600 text-sm mt-1">
                {destination}
              </p>
            </div>
            <button
              ref={closeButtonRef}
              onClick={onClose}
              className="text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 rounded-full px-3 py-2 transition"
              aria-label={text.closeBusDetail}
            >
              ×
            </button>
          </div>

          <div className="p-6 space-y-6">
            <div className="space-y-4">
              <h3 className="font-bold text-lg text-neutral-900">
                {text.currentBus}
              </h3>

              {!bus.predictTime1 || bus.predictTime1 <= 0 ? (
                <div className="bg-gray-50 rounded-lg p-4 text-center text-neutral-500">
                  {text.noArrivalInfo}
                </div>
              ) : (
                <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-600">{text.arrivingIn}</span>
                    <div className="flex items-baseline gap-2">
                      {bus.locationNo1 && bus.locationNo1 > 0 && (
                        <span className="text-neutral-700">
                          {formatStopsBefore(bus.locationNo1, text, locale)} |
                        </span>
                      )}
                      <span className="text-xl font-bold text-blue-600">
                        {formatMinutes(
                          Math.ceil(bus.predictTime1 || 0),
                          text,
                          locale,
                        )}
                      </span>
                    </div>
                  </div>

                  {bus.nextStation1 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-neutral-600">{text.nextStation}</span>
                      <span className="font-medium text-neutral-900">
                        {bus.nextStation1}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <span className="text-neutral-600">{text.busType}</span>
                    <span>
                      {bus.isLow1 ? (
                        <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                          {text.lowFloorBus}
                        </span>
                      ) : (
                        <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">
                          {text.regularBus}
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-neutral-600">{text.seatStatus}</span>
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
                    {text.nextBus}
                  </h3>

                  <div className="bg-neutral-50 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-neutral-600">{text.arrivingIn}</span>
                      <div className="flex items-baseline gap-2">
                        {bus.locationNo2 && bus.locationNo2 > 0 && (
                          <span className="text-neutral-700">
                            {formatStopsBefore(bus.locationNo2, text, locale)} |
                          </span>
                        )}
                        <span className="text-xl font-bold text-neutral-700">
                          {formatMinutes(
                            Math.ceil(bus.predictTime2 || 0),
                            text,
                            locale,
                          )}
                        </span>
                      </div>
                    </div>

                    {bus.nextStation2 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-neutral-600">
                          {text.nextStation}
                        </span>
                        <span className="font-medium text-neutral-900">
                          {bus.nextStation2}
                        </span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-neutral-600">{text.busType}</span>
                      <span>
                        {bus.isLow2 ? (
                          <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-sm font-medium">
                            {text.lowFloorBus}
                          </span>
                        ) : (
                          <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-sm font-medium">
                            {text.regularBus}
                          </span>
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-neutral-600">{text.seatStatus}</span>
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
              {text.close}
            </button>
          </div>
      </div>
    </div>
  );
}

function getDestinationLabel(
  stopId: string | undefined,
  direction: "up" | "down" | null,
  text: BusInfoDictionary,
) {
  if (stopId?.includes("jungmun") && direction === "up") {
    return text.destinations.damteogogae;
  }

  if (stopId?.includes("jungmun") && direction === "down") {
    return text.destinations.taereungRink;
  }

  if (stopId?.includes("humun") && direction === "up") {
    return text.destinations.mirinaeHanbyeol;
  }

  if (stopId?.includes("humun") && direction === "down") {
    return text.destinations.taereungRink;
  }

  return text.destinationFallback;
}

function formatStopsBefore(
  count: number,
  text: BusInfoDictionary,
  locale: "ko" | "en",
) {
  return locale === "ko"
    ? `${count}${text.stopsBefore}`
    : `${count} ${text.stopsBefore}`;
}

function formatMinutes(
  minutes: number,
  text: BusInfoDictionary,
  locale: "ko" | "en",
) {
  return locale === "ko"
    ? `${minutes}${text.minutesUnit}`
    : `${minutes} ${text.minutesUnit}`;
}
