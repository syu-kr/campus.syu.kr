import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "시간표 짜기 | SYU CAMPUS",
  description: "학기 강의 시간표를 직접 구성하고 공유할 수 있습니다.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
