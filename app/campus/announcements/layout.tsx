import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "캠퍼스공지 | 삼육대 캠퍼스",
  description: "캠퍼스 공지사항",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
