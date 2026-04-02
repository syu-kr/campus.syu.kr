"use client";

import React, { memo, useEffect } from "react";
import { type WeatherData } from "@/lib/weather";

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
  // Escape 키로 모달 닫기
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !weather) {
    return null;
  }

  const getSkyConditionDetail = (skyCondition: number): string => {
    switch (skyCondition) {
      case 0:
        return "맑음";
      case 1:
        return "구름많음";
      case 3:
        return "흐림";
      default:
        return "알 수 없음";
    }
  };

  const getPrecipitationDetail = (precipitation: number): string => {
    switch (precipitation) {
      case 0:
        return "없음";
      case 1:
        return "비";
      case 2:
        return "진눈깨비";
      case 3:
        return "눈";
      default:
        return "알 수 없음";
    }
  };

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* 모달 박스 */}
      <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
        <div
          className="bg-white rounded-xl shadow-lg max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 헤더 - 날씨 요약 */}
          <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-8">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                  <div
                    className="w-12 h-12"
                    dangerouslySetInnerHTML={{
                      __html: `
                        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <circle cx="12" cy="12" r="5" fill="#FFFFFF"/>
                          <line x1="12" y1="1" x2="12" y2="3" stroke="#FFFFFF" stroke-width="2"/>
                          <line x1="12" y1="21" x2="12" y2="23" stroke="#FFFFFF" stroke-width="2"/>
                          <line x1="1" y1="12" x2="3" y2="12" stroke="#FFFFFF" stroke-width="2"/>
                          <line x1="21" y1="12" x2="23" y2="12" stroke="#FFFFFF" stroke-width="2"/>
                        </svg>
                      `,
                    }}
                  />
                </div>
              </div>
              <div className="text-4xl font-bold text-white mb-2">
                {weather.temperature}°C
              </div>
              <div className="text-blue-50 text-lg">
                현재 날씨는 {getSkyConditionDetail(weather.skyCondition)}{" "}
                입니다.
              </div>
            </div>
          </div>

          {/* 상세 정보 */}
          <div className="px-6 py-6 space-y-4">
            {/* 강수 형태 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-blue-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
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
                    강수형태
                  </p>
                  <p className="text-sm font-semibold text-neutral-800">
                    {getPrecipitationDetail(weather.precipitation)}
                  </p>
                </div>
              </div>
            </div>

            {/* 풍속 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-green-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m0 0l-2-1m2 1v2.5M14 4l-2 1m0 0L10 4m2 1V2.5M20 4l-2 1m0 0l-2-1m2 1V2.5"
                    />
                  </svg>
                </div>
                <div>
                  <p className="text-xs font-medium text-neutral-500">풍속</p>
                  <p className="text-sm font-semibold text-neutral-800">
                    {weather.windSpeed} m/s
                  </p>
                </div>
              </div>
            </div>

            {/* 하늘 상태 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-purple-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
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
                    하늘상태
                  </p>
                  <p className="text-sm font-semibold text-neutral-800">
                    {getSkyConditionDetail(weather.skyCondition)}
                  </p>
                </div>
              </div>
            </div>

            {/* 위치 및 시간 */}
            <div className="mt-6 pt-6 border-t border-neutral-200">
              <div className="space-y-3">
                {/* 위치 */}
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 flex-shrink-0 text-neutral-600">
                    <svg
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-13c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-neutral-500">위치</p>
                    <p className="text-sm font-semibold text-neutral-800">
                      삼육대학교
                    </p>
                  </div>
                </div>

                {/* 업데이트 시간 */}
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 flex-shrink-0 text-neutral-600">
                    <svg
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-neutral-500">
                      업데이트
                    </p>
                    <p className="text-sm font-semibold text-neutral-800">
                      {weather.time}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 닫기 버튼 */}
          <div className="px-6 pb-6">
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium rounded-lg transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export const WeatherModal = memo(WeatherModalComponent);

export default WeatherModal;
