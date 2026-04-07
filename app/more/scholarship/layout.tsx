import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "장학금 | SYU CAMPUS",
  description: "장학금",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
