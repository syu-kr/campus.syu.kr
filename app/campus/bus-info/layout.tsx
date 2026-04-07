import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "버스 정보 | 삼육대 캠퍼스",
  description: "버스 정보",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
