import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "알림 및 개인정보 | SYU CAMPUS",
  description: "SYU CAMPUS의 브라우저 알림 권한과 분석 도구 사용 안내입니다.",
};

export default function NotificationPrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
