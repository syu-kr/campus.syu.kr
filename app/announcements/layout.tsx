import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "전체 공지 | SYU CAMPUS",
  description: "학사공지, 캠퍼스공지, 장학금 공지를 한곳에서 확인하세요.",
};

export default function AnnouncementsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
