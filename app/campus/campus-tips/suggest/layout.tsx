import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "꿀팁 제보하기 | SYU CAMPUS",
  description: "캠퍼스 꿀팁 자료에 추가할 링크와 내용을 제보하는 페이지입니다.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function CampusTipSuggestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
