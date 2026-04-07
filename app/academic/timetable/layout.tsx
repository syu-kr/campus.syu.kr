import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "강의시간표 | 삼육대 캠퍼스",
  description: "강의시간표",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
