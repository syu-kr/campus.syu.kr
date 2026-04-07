import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "학식 | 삼육대 캠퍼스",
  description: "학식 메뉴",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
