import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "버스 정보",
  description: "셔틀버스 및 대중교통 정보",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
