import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "졸업요건 자가진단 | SYU CAMPUS",
  description:
    "입학년도, 학과, 입학유형에 맞는 졸업요건을 확인하고 이수 현황을 점검하세요.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
