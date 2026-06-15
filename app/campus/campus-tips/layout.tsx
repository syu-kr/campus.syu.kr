import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "캠퍼스 꿀팁 | SYU CAMPUS",
  description: "학교생활, 진로, 대외활동, 지역 정보 링크 모음",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
