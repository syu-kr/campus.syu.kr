import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "전화번호부 | 삼육대 캠퍼스",
  description: "연락처",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
