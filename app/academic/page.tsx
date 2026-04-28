import { Metadata } from "next";
import Link from "next/link";

import { AcademicMenuGrid } from "@/app/academic/AcademicMenuGrid";
import { Container } from "@/app/components/Container";

export const metadata: Metadata = {
  title: "학사 정보 | SYU CAMPUS",
  description:
    "삼육대학교 학사 정보 센터. 학사일정, 공지사항, 졸업요건 확인 등 핵심 학사 정보를 한 방에 제공합니다.",
  keywords: "학사,학사일정,학사공지,졸업요건,시간표",
  openGraph: {
    title: "학사 정보 | SYU CAMPUS",
    description: "학사 관련 모든 정보를 한눈에 확인할 수 있는 학사 정보",
    type: "website",
    url: "https://campus.syu.kr/academic",
  },
};

export default function AcademicPage() {
  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">
          학사 정보
        </h1>
        <p className="text-neutral-600">학사 관련 정보를 한눈에 확인하세요</p>
      </div>

      <AcademicMenuGrid />

      {/* 관련 정보 */}
      <div className="mt-8 pt-6 border-t border-neutral-200">
        <h3 className="text-base font-semibold text-neutral-900 mb-4">
          참고해보세요
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Link
            href="/campus/bus-info"
            className="p-4 rounded-lg bg-blue-50 border border-blue-200 hover:border-blue-500 transition-colors"
          >
            <p className="text-sm font-medium text-neutral-900">
              🚍 캠퍼스 찾기
            </p>
            <p className="text-xs text-neutral-600 mt-1">
              버스 정보를 활용하여 캠퍼스 이동
            </p>
          </Link>
          <Link
            href="/more/phone"
            className="p-4 rounded-lg bg-purple-50 border border-purple-200 hover:border-purple-500 transition-colors"
          >
            <p className="text-sm font-medium text-neutral-900">
              📞 부서 연락처
            </p>
            <p className="text-xs text-neutral-600 mt-1">
              학사 관련 문의는 해당 부서로
            </p>
          </Link>
        </div>
      </div>
    </Container>
  );
}
