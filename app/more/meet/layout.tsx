import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "일정 잡기 | SYU CAMPUS",
  description: "초대 링크로 함께 가능한 시간을 찾는 일정 잡기",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
