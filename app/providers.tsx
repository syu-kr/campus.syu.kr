"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Analytics } from "@vercel/analytics/react";
import { ReactNode, useEffect } from "react";

// QueryClient를 싱글톤으로 관리
let clientSingleton: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // 서버: 항상 새로운 인스턴스 생성
    return new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000, // 1분
        },
      },
    });
  }

  // 브라우저: 싱글톤 사용
  if (!clientSingleton) {
    clientSingleton = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 60 * 1000,
        },
      },
    });
  }

  return clientSingleton;
}

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  const queryClient = getQueryClient();

  // Service Worker 등록
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => {
          console.log("✓ Service Worker 등록 완료");
        })
        .catch((error) => {
          console.error("✗ Service Worker 등록 실패:", error);
        });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Analytics />
      {children}
    </QueryClientProvider>
  );
}
