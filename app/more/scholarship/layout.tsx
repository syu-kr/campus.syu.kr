import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "장학금 | 삼육대 캠퍼스",
  description: "장학금",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
