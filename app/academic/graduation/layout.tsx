import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "졸업요건 | SYU CAMPUS",
  description: "졸업요건 간편 확인",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
