import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "보건센터 | SYU CAMPUS",
  description: "보건센터",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
