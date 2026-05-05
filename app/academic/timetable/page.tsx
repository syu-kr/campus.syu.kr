"use client";

import Link from "next/link";
import { Card } from "@/app/components/Card";
import { Container } from "@/app/components/Container";
import { Icon } from "@/app/components/Icon";

export default function TimetableWizardPage() {
  return (
    <Container className="py-6 sm:py-8">
      <div className="mb-8">
        <Link
          href="/academic"
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-neutral-600 hover:text-neutral-900"
        >
          <Icon name="chevron-right" size={16} className="rotate-180" />
          학사 정보
        </Link>
        <h1 className="mb-2 text-2xl font-bold text-neutral-900 sm:text-3xl">
          시간표 짜기
        </h1>
        <p className="text-neutral-600">
          SYU CAMPUS 내부 시간표 작성 기능은 아직 제공하지 않습니다.
        </p>
      </div>

      <Card hover={false} className="border border-neutral-200">
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">
              외부 시간표 서비스로 이동합니다
            </p>
            <p className="mt-2 text-sm leading-6 text-amber-800">
              아래 버튼은 SYU KR에서 운영하는 외부 시간표 서비스로 새 탭을
              엽니다. 외부 서비스의 이용 조건과 표시 정보는 해당 사이트 기준을
              따릅니다.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <a
              href="https://lecture.syu.kr/timetable"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-lg bg-primary-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-700"
            >
              외부 서비스에서 시간표 작성
            </a>
            <Link
              href="/academic"
              className="inline-flex items-center justify-center rounded-lg border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold text-neutral-800 transition-colors hover:bg-neutral-50"
            >
              학사 정보로 돌아가기
            </Link>
          </div>
        </div>
      </Card>
    </Container>
  );
}
