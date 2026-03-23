import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "보건센터",
  description: "캠퍼스 보건센터 운영 정보",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
