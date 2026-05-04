"use client";

import { ContactModal } from "./components/ContactModal";
import { Icon } from "./components/Icon";
import Link from "next/link";
import { useEffect, useState } from "react";

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
  const [isContactOpen, setIsContactOpen] = useState(false);

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

      <main className="flex-1 flex items-center justify-center px-4 py-20 md:py-24 relative z-10">
        <div className="max-w-lg w-full text-center">
          <div className="mb-8 flex justify-center">
            <div className="relative h-32 w-32">
              <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-blue-400 border-r-blue-300 animate-spin-slow" />
              <div className="absolute inset-2 bg-gradient-to-br from-blue-50 to-blue-100 rounded-full animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-blue-400 animate-float">
                  ?
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <h1 className="text-6xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-600 via-blue-500 to-blue-400 mb-3">
              404
            </h1>
            <p className="text-lg md:text-xl text-gray-700 font-bold mb-2 whitespace-pre-line">
              {funMessage}
            </p>
            <p className="text-gray-500 text-sm">
              찾으시던 페이지가 존재하지 않거나 이동된 것 같아요.
            </p>
          </div>

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

            <button
              type="button"
              onClick={() => setIsContactOpen(true)}
              className="flex items-center justify-center gap-2 w-full bg-white hover:bg-blue-50 text-blue-700 border-2 border-blue-200 font-bold py-4 px-4 rounded-xl transition-all duration-300 hover:shadow-lg active:scale-95 text-lg group"
            >
              <Icon
                name="megaphone"
                size={24}
                color="rgb(29, 78, 216)"
                className="group-hover:scale-110 transition-transform"
              />
              <span>사이트 문의하기</span>
            </button>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-5 text-left">
            <p className="text-sm font-bold text-gray-800 mb-3">
              페이지를 찾지 못했어요
            </p>
            <ul className="text-sm text-gray-700 space-y-2 font-medium">
              <li>URL에 오타가 있는지 확인해 주세요.</li>
              <li>계속 문제가 생기면 사이트 문의하기로 알려주세요.</li>
            </ul>
          </div>
        </div>
      </main>

      <ContactModal
        isOpen={isContactOpen}
        onClose={() => setIsContactOpen(false)}
      />

      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
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
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-blue-50 opacity-40" />
      </div>
    </div>
  );
}
