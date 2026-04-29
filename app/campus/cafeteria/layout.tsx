import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "학식 | SYU CAMPUS",
  description: "삼육대학교 주간 식단과 오늘의 학식 정보를 확인하세요.",
  alternates: {
    canonical: "https://campus.syu.kr/campus/cafeteria",
  },
};

export default function CafeteriaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
