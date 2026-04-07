import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "캠퍼스공지 | SYU CAMPUS",
  description: "캠퍼스 공지사항",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
