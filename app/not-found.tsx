"use client";

import Link from "next/link";
import { Icon } from "./components/Icon";
import { useState, useEffect } from "react";

const funMessages = [
  "어... 여기 아무것도 없네요",
  "이 페이지는 숨바꼭질 중입니다",
  "404... 404... 어디 있어요?",
  "이 길은 막혔어요",
  "404 Not Found in the system\n404 The new era era",
  "페이지가 방학을 가버렸나 봐요",
];

export default function NotFound() {
  const [funMessage, setFunMessage] = useState("어... 여기 아무것도 없네요");

  useEffect(() => {
    setFunMessage(funMessages[Math.floor(Math.random() * funMessages.length)]);
  }, []);

  return (
    <div className="min-h-screen flex flex-col overflow-hidden">
      <style>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes bounce-x {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(10px); }
        }
        
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
        
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
        
        .animate-bounce-x {
          animation: bounce-x 1s ease-in-out infinite;
        }
      `}</style>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-4 py-20 md:py-24 relative z-10">
        <div className="max-w-lg w-full text-center">
          {/* Animated 404 Icon */}
          <div className="mb-8 flex justify-center">
            <div className="relative h-32 w-32">
              {/* Outer rotating ring */}
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-400 border-r-blue-300 animate-spin-slow" />

              {/* Middle pulsing circle */}
              <div className="absolute inset-2 bg-gradient-to-br from-blue-50 to-blue-100 rounded-full animate-pulse" />

              {/* Inner content */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-400 animate-float">
                  ?
                </div>
              </div>
            </div>
          </div>

          {/* Main Message */}
          <div className="mb-6">
            <h1 className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400 mb-3">
              404
            </h1>
            <p className="text-lg md:text-xl text-gray-700 font-bold mb-2 whitespace-pre-line">
              {funMessage}
            </p>
            <p className="text-gray-500 text-sm">
              찾으시던 페이지가 이 세상에 존재하지 않는 것 같아요...
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-3 mb-8">
            <Link
              href="/"
              className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white font-bold py-4 px-4 rounded-xl transition-all duration-300 hover:shadow-2xl hover:shadow-blue-500/40 active:scale-95 text-lg group"
            >
              <Icon
                name="home"
                size={24}
                color="white"
                className="group-hover:animate-bounce-x"
              />
              <span>홈으로 돌아가기</span>
              <Icon
                name="chevron-right"
                size={20}
                color="white"
                className="ml-auto group-hover:translate-x-1 transition-transform"
              />
            </Link>

            {/* Grid of fun options */}
            <div className="grid grid-cols-2 gap-2 mt-6">
              <Link
                href="/academic/announcements"
                className="group flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 text-orange-600 font-semibold py-4 px-3 rounded-xl transition-all duration-200 hover:shadow-lg active:scale-95"
              >
                <Icon
                  name="search"
                  size={24}
                  color="rgb(234, 88, 12)"
                  className="group-hover:scale-110 transition-transform"
                />
                <span className="text-xs">공지사항</span>
              </Link>

              <Link
                href="/campus/map"
                className="group flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-green-50 to-green-100 hover:from-green-100 hover:to-green-200 text-green-600 font-semibold py-4 px-3 rounded-xl transition-all duration-200 hover:shadow-lg active:scale-95"
              >
                <Icon
                  name="map-pin"
                  size={24}
                  color="rgb(34, 197, 94)"
                  className="group-hover:scale-110 transition-transform"
                />
                <span className="text-xs">캠퍼스 지도</span>
              </Link>

              <Link
                href="/campus/cafeteria"
                className="group flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-red-50 to-red-100 hover:from-red-100 hover:to-red-200 text-red-600 font-semibold py-4 px-3 rounded-xl transition-all duration-200 hover:shadow-lg active:scale-95"
              >
                <Icon
                  name="utensils"
                  size={24}
                  color="rgb(220, 38, 38)"
                  className="group-hover:scale-110 transition-transform"
                />
                <span className="text-xs">학식 정보</span>
              </Link>

              <Link
                href="/"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.reload();
                }}
                className="group flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 text-purple-600 font-semibold py-4 px-3 rounded-xl transition-all duration-200 hover:shadow-lg active:scale-95"
              >
                <Icon
                  name="rotate-ccw"
                  size={24}
                  color="rgb(147, 51, 234)"
                  className="group-hover:animate-spin-slow transition-transform"
                />
                <span className="text-xs">새로고침</span>
              </Link>
            </div>
          </div>

          {/* Fun Info Box */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5 text-left">
            <p className="text-sm font-bold text-gray-800 mb-3">
              혹시 이런 건 아닐까요?
            </p>
            <ul className="text-sm text-gray-700 space-y-2 font-medium">
              <li>✓ URL에 오타가 있을 수도 있어요</li>
              <li>✓ 페이지가 이전되었을 수도 있어요</li>
              <li>✓ 예정된 페이지일 수도 있어요</li>
              <li>✓ 혹은... 우주의 신비일 수도?</li>
            </ul>
          </div>
        </div>
      </main>

      {/* Animated Background Elements */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        {/* Floating shapes */}
        <div
          className="absolute top-20 right-10 w-40 h-40 bg-blue-100 rounded-full blur-3xl opacity-30 animate-float"
          style={{ animationDelay: "0s" }}
        />
        <div
          className="absolute bottom-32 left-10 w-56 h-56 bg-indigo-100 rounded-full blur-3xl opacity-30 animate-float"
          style={{ animationDelay: "1s" }}
        />
        <div
          className="absolute top-1/2 right-1/4 w-32 h-32 bg-blue-50 rounded-full blur-2xl opacity-20 animate-float"
          style={{ animationDelay: "2s" }}
        />

        {/* Grid pattern */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-blue-50 opacity-40" />
      </div>
    </div>
  );
}
