"use client";

import Link from "next/link";
import { protectRoommateLinkPrivacy } from "@/lib/roommate-link-privacy";

export function RoommateMenuLink(props: React.ComponentProps<typeof Link>) {
  return <Link {...props} prefetch={false} onClick={(event) => { protectRoommateLinkPrivacy(); props.onClick?.(event); }} />;
}
