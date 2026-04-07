import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "셔틀버스 | SYU CAMPUS",
  description: "셔틀버스",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
