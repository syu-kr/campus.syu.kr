import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "체육관 | SYU CAMPUS",
  description: "체육관",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
