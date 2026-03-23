import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "더보기",
  description: "장학금, 연락처, 서비스 공지 등",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
