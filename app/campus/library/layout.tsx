import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "도서관 | SYU CAMPUS",
  description: "도서관",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
