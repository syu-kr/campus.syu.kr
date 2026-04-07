import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "보건센터 | 삼육대 캠퍼스",
  description: "보건센터",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
