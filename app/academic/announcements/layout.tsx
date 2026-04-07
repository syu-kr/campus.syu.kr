import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "학사공지 | 삼육대 캠퍼스",
  description: "학사 관련 주요 공지사항",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
