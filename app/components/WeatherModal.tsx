"use client";

import { memo } from "react";
import { type WeatherData } from "@/lib/weather";
import { WeatherIcon } from "@/app/components/WeatherIcon";
import { LiveDataStatusBadge } from "@/app/components/LiveDataStatusBadge";
import { useDictionary, useLocale } from "@/app/components/LocaleProvider";
import { Modal } from "@/app/components/Modal";

interface WeatherModalProps {
  isOpen: boolean;
  weather: WeatherData | null;
  onClose: () => void;
}

function WeatherModalComponent({
  isOpen,
  weather,
  onClose,
}: WeatherModalProps) {
  const dictionary = useDictionary();
  const locale = useLocale();

  if (!isOpen || !weather) {
    return null;
  }

  const getSkyConditionDetail = (skyCondition: number): string => {
    switch (skyCondition) {
      case 1:
        return dictionary.weather.clear;
      case 3:
        return dictionary.weather.partlyCloudy;
      case 4:
        return dictionary.weather.cloudy;
      default:
        return dictionary.weather.unknown;
    }
  };

  const getPrecipitationDetail = (precipitation: number): string => {
    switch (precipitation) {
      case 0:
        return dictionary.weather.none;
      case 1:
        return dictionary.weather.rain;
      case 2:
        return dictionary.weather.rainSnow;
      case 3:
        return dictionary.weather.snow;
      case 5:
        return dictionary.weather.drizzle;
      case 6:
        return dictionary.weather.rainSnowFlurry;
      case 7:
        return dictionary.weather.snowFlurry;
      default:
        return dictionary.weather.unknown;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      title={dictionary.weather.label}
      description={`${weather.temperature}°C, ${getSkyConditionDetail(weather.skyCondition)}`}
      onClose={onClose}
      size="sm"
      bodyClassName="space-y-5"
    >
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 px-5 py-6 text-center">
        <div className="mb-4 flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white shadow-sm ring-1 ring-neutral-200">
            <WeatherIcon weather={weather} className="h-12 w-12" />
          </div>
        </div>
        <div className="mb-2 text-4xl font-bold text-neutral-900">
          {weather.temperature}°C
        </div>
        <div className="text-base font-medium text-neutral-700">
          {dictionary.weather.current}{" "}
          {getSkyConditionDetail(weather.skyCondition)}
          {dictionary.weather.currentSuffix}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 3v1m6.364 1.636l-.707.707M21 12h-1m1.364 6.364l-.707-.707M12 21v1m-6.364-1.636l.707-.707M3 12h1M3.636 5.636l.707.707"
              />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">
              {dictionary.weather.precipitation}
            </p>
            <p className="text-sm font-semibold text-neutral-800">
              {getPrecipitationDetail(weather.precipitation)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 14l3-3m0 0l3 3m-3-3v8m6-10h2a2 2 0 012 2v8a2 2 0 01-2 2h-2m0-14h-4a2 2 0 00-2 2v8a2 2 0 002 2h4m0-14v14"
              />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">
              {dictionary.weather.windSpeed}
            </p>
            <p className="text-sm font-semibold text-neutral-800">
              {weather.windSpeed} m/s
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-600">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3v-6"
              />
            </svg>
          </div>
          <div>
            <p className="text-xs font-medium text-neutral-500">
              {dictionary.weather.skyCondition}
            </p>
            <p className="text-sm font-semibold text-neutral-800">
              {getSkyConditionDetail(weather.skyCondition)}
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-neutral-200 pt-5">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="h-5 w-5 flex-shrink-0 text-neutral-600">
              <svg
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-13c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500">
                {dictionary.weather.location}
              </p>
              <p className="text-sm font-semibold text-neutral-800">
                {dictionary.labels.sahmyookUniversity}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-5 w-5 flex-shrink-0 text-neutral-600">
              <svg
                fill="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
                focusable="false"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-medium text-neutral-500">
                {dictionary.weather.updated}
              </p>
              <p className="text-sm font-semibold text-neutral-800">
                {weather.time}
              </p>
            </div>
          </div>
        </div>
        <LiveDataStatusBadge
          locale={locale}
          sourceLabel={dictionary.liveData.sources.weather}
          timestamp={weather.timestamp}
          stale={weather.stale}
          sourceStatus={weather.sourceStatus}
          className="mt-4"
        />
      </div>

      <button
        type="button"
        onClick={onClose}
        className="w-full rounded-lg bg-primary-600 px-4 py-2 font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
      >
        {dictionary.weather.close}
      </button>
    </Modal>
  );
}

export const WeatherModal = memo(WeatherModalComponent);
