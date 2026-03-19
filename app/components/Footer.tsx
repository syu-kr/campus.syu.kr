"use client";

import React from "react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-white border-t border-neutral-200 mt-12 pb-20 md:pb-0">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="font-bold text-neutral-900 mb-4">SYU CAMPUS</h3>
            <p className="text-sm text-neutral-600">
              삼육대학교 학생을 위한
              <br />
              통합 정보 플랫폼
            </p>
          </div>

          <div>
            <h4 className="font-semibold text-neutral-900 mb-3">주요 메뉴</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href="/academic"
                  className="text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  학사 정보
                </a>
              </li>
              <li>
                <a
                  href="/campus"
                  className="text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  캠퍼스 정보
                </a>
              </li>
              <li>
                <a
                  href="/tuition"
                  className="text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  등록금
                </a>
              </li>
              <li>
                <a
                  href="/more"
                  className="text-neutral-600 hover:text-neutral-900 transition-colors"
                >
                  더보기
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="font-semibold text-neutral-900 mb-3">문의</h4>
            <ul className="space-y-2 text-sm text-neutral-600">
              <li>서비스 문의 및 제안</li>
              <li className="font-medium text-primary-600">
                support_team@syu.kr
              </li>
              <li className="text-xs text-neutral-500 mt-3">
                평일 09:00~18:00
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-neutral-200 pt-6">
          <div className="flex items-center justify-between">
            <p className="text-sm text-neutral-600">
              © {currentYear} SYU KR. All rights reserved.
            </p>
            <div className="flex gap-4 text-sm">
              <a
                href="/terms"
                className="text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                이용약관
              </a>
              <a
                href="/privacy"
                className="text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                개인정보처리방침
              </a>
              <a
                href="mailto:support_team@syu.kr"
                className="text-neutral-600 hover:text-neutral-900 transition-colors"
              >
                문의
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
