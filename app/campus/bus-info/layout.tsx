import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "버스 정보 | SYU CAMPUS",
  description: "버스 정보",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
