import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "체육관 | 삼육대 캠퍼스",
  description: "체육관",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
