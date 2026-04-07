import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "학사일정 | 삼육대 캠퍼스",
  description: "학사일정",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
