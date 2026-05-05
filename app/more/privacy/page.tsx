"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { Icon } from "@/app/components/Icon";

type PermissionState = "granted" | "denied" | "default" | "unsupported";

const permissionLabels: Record<PermissionState, string> = {
  granted: "알림 허용됨",
  denied: "알림 차단됨",
  default: "아직 선택하지 않음",
  unsupported: "이 브라우저에서 지원하지 않음",
};

export default function NotificationPrivacyPage() {
  const [permission, setPermission] = useState<PermissionState>("unsupported");

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }

    setPermission(Notification.permission as PermissionState);
  }, []);

  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <Link
          href="/more"
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          <Icon name="chevron-right" size={16} className="rotate-180" />
          더보기
        </Link>
        <h1 className="mb-2 text-2xl font-bold text-neutral-900 sm:text-3xl">
          알림 및 개인정보
        </h1>
        <p className="text-neutral-600">
          알림 권한, 분석 도구, 개인정보 안내를 한곳에서 확인하세요.
        </p>
      </div>

      <div className="grid gap-4">
        <Card hover={false} className="border border-neutral-200">
          <div className="flex items-start gap-3">
            <Icon
              name="info"
              size={22}
              color="rgb(37, 99, 235)"
              className="mt-0.5 flex-shrink-0"
            />
            <div>
              <h2 className="text-base font-semibold text-neutral-900">
                브라우저 알림 상태
              </h2>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                현재 브라우저의 SYU CAMPUS 알림 권한은{" "}
                <strong className="text-neutral-900">
                  {permissionLabels[permission]}
                </strong>
                입니다.
              </p>
              <p className="mt-2 text-sm leading-6 text-neutral-600">
                알림을 끄려면 브라우저 사이트 설정에서 campus.syu.kr의 알림
                권한을 차단하거나 삭제하세요. 이 화면에서는 새 알림 권한을
                요청하지 않습니다.
              </p>
            </div>
          </div>
        </Card>

        <Card hover={false} className="border border-neutral-200">
          <h2 className="text-base font-semibold text-neutral-900">
            분석 도구 사용
          </h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            서비스 품질 개선과 오류 파악을 위해 Google Analytics가 사용됩니다.
            분석 데이터는 개인정보처리방침의 목적과 범위 안에서 다룹니다.
          </p>
          <Link
            href="/privacy"
            className="mt-4 inline-flex rounded-lg border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-50"
          >
            개인정보처리방침 보기
          </Link>
        </Card>

        <Card hover={false} className="border border-neutral-200 bg-neutral-50">
          <h2 className="text-base font-semibold text-neutral-900">
            권한 요청 원칙
          </h2>
          <p className="mt-2 text-sm leading-6 text-neutral-600">
            SYU CAMPUS는 사용자의 명시적인 브라우저 권한 없이는 푸시 알림을
            보낼 수 없습니다. 이미 알림을 허용한 경우에만 알림 토큰을 등록해
            서비스 공지를 받을 수 있게 합니다.
          </p>
        </Card>
      </div>
    </Container>
  );
}
