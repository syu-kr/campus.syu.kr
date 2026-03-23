import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "도서관",
  description: "캠퍼스 도서관 열람실 정보",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
