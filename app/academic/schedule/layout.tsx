import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "학사일정",
  description: "수강신청, 시험, 휴무 일정",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
