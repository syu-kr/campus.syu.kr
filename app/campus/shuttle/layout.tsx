import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "셔틀버스 | 삼육대 캠퍼스",
  description: "셔틀버스",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
