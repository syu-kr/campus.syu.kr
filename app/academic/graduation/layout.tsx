import { Metadata } from "next";

export const metadata: Metadata = {
  title: "졸업요건 확인",
  description: "내 상황에 맞는 졸업요건을 확인해보세요",
};

export default function GraduationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
