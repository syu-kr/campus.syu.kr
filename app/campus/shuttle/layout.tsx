import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "셔틀버스",
  description: "캠퍼스 셔틀버스 운행 시간표",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
