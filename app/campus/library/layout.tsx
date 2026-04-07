import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "도서관 | 삼육대 캠퍼스",
  description: "도서관",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
