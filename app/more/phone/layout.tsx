import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "연락처 | SYU CAMPUS",
  description: "부서 및 담당자 연락처 검색",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
