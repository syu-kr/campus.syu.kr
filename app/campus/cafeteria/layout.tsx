import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "학식 | SYU CAMPUS",
  description: "학식 메뉴",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
