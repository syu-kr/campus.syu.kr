"use client";

import { Suspense, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getSitePresentationRoute } from "@/lib/site-presentation";
import { SearchReturn } from "./SearchReturn";

export function SiteContent({ children, initialPathname }: { children: ReactNode; initialPathname: string }) {
  const pathname = usePathname() || initialPathname;
  return <main className="m3-content" data-site-route={getSitePresentationRoute(pathname)}>
    {children}
    <Suspense fallback={null}><SearchReturn /></Suspense>
  </main>;
}
