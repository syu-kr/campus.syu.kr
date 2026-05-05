import { Metadata } from "next";

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
    </Container>
  );
}
