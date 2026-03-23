import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "캠퍼스 지도",
  description: "캠퍼스 건물 및 시설 지도",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
