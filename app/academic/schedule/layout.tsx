import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "학사일정 | SYU CAMPUS",
  description: "학사일정",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
