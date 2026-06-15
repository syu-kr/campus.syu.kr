import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "장학금 | SYU CAMPUS",
  description: "장학금 공지 및 신청",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
