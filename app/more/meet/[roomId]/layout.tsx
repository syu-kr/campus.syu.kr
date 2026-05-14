import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "일정 방 | SYU CAMPUS",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default function MeetRoomLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
