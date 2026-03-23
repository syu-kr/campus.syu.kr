import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "캠퍼스공지",
  description: "캠퍼스 생활 공지사항",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
