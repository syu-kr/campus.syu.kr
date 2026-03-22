"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactNode } from "react";

// QueryClient를 싱글톤으로 관리
let clientSingleton: QueryClient | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    // 서버: 항상 새로운 인스턴스 생성
    return new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 10 * 60 * 1000, // 10분
          gcTime: 60 * 60 * 1000, // 1시간 (이전 cacheTime)
        },
      },
    });
  }

  // 브라우저: 싱글톤 사용
  if (!clientSingleton) {
    clientSingleton = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 10 * 60 * 1000, // 10분
          gcTime: 60 * 60 * 1000, // 1시간
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

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
