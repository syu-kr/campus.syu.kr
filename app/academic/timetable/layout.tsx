import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "강의시간표",
  description: "수강신청한 강의의 시간표",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
