import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "체육관",
  description: "캠퍼스 체육관 운영 정보",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
