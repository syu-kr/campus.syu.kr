import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "학식",
  description: "캠퍼스 학식 메뉴 및 영양정보",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
