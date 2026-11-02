import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TermsPage, { generateMetadata } from "./page";

const request = vi.hoisted(() => ({ locale: "ko" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-syu-locale": request.locale }),
}));

describe.each(["ko", "en"])("Terms effective dates (%s)", (locale) => {
  it.each([
    ["2026-11-03T12:00:00+09:00", true],
    ["2026-11-04T00:00:00+09:00", false],
    ["2026-12-03T23:59:59.999+09:00", false],
  ])("keeps the announced November 4 clauses at %s", async (time, upcoming) => {
    request.locale = locale;
    vi.spyOn(Date, "now").mockReturnValue(Date.parse(time));
    render(await TermsPage());
    const expectedTitle = locale === "en"
      ? upcoming ? "Upcoming Terms of Use" : "Terms of Use"
      : upcoming ? "이용약관 개정안 (시행 예정)" : "이용약관";
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(expectedTitle);
    expect((await generateMetadata()).title).toBe(expectedTitle);
    expect(screen.getByText(locale === "en"
      ? "Malicious crawling, scraping, automation, or server load generation"
      : "자동화 도구/봇을 이용한 서버 부하 행위 (개인적 서버 테스트 제외)")).toBeInTheDocument();
    expect(screen.getByText(locale === "en"
      ? /Timetable sharing may store selected course IDs, year, semester, and request metadata/
      : /공유 링크 생성 시점의 브라우저 정보가 링크 생성과 조회를 위해/)).toBeInTheDocument();
    const link = screen.getByRole("link", { name: locale === "en"
      ? "Existing and upcoming clauses, reasons, and effective date"
      : "기존·시행 예정 조항과 변경 사유·시행일 확인" });
    expect(link).toHaveAttribute("href", (locale === "en" ? "/en" : "") + "/service/notices/021-policy-clarifications");
    expect(screen.getByText(locale === "en"
      ? /The load-testing and timetable-sharing clauses will change/
      : /부하 시험·시간표 공유 조항은.*변경됩니다/)).toBeInTheDocument();
  });

  it("applies only the clarified clauses at December 4 midnight KST", async () => {
    request.locale = locale;
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-12-04T00:00:00+09:00"));
    const { container } = render(await TermsPage());
    expect(container).not.toHaveTextContent("공유 링크 생성 시점의 브라우저 정보");
    expect(container).not.toHaveTextContent("request metadata for creating and loading");
    expect(container).not.toHaveTextContent("개인적 서버 테스트 제외");
    expect(container).not.toHaveTextContent("Malicious crawling, scraping, automation, or server load generation");
    expect(screen.getByText(locale === "en"
      ? /Load testing the production service.*provider's prior permission.*isolated environment that you control/
      : /제공자의 사전 허락 없이.*본인이 관리하는 격리된 시험 환경/)).toBeInTheDocument();
    expect(screen.getByText(locale === "en"
      ? /Timetable sharing stores selected course IDs.*comparison mode.*owner-token hash/
      : /시간표 공유 기능은 선택한 강의 식별자.*비교 모드.*소유 토큰 해시/)).toBeInTheDocument();
    expect(container).toHaveTextContent(locale === "en"
      ? "Roommate reports do not use the site's AI classification tools"
      : "AI 분류 도구는 룸메이트 신고에 적용하지 않습니다");
    expect(container).toHaveTextContent(locale === "en"
      ? "at least 30 days in advance"
      : "최소 30일 이전에 공지");
  });
});

it("preserves the previously published bilingual Terms notice byte content", () => {
  for (const [file, hash] of [
    ["017-roommate-board.md", "a8f8d4e43445b7e0d4d0513917878e967baa4ad3eaafd905bbd1997bb1304912"],
    ["en/017-roommate-board.md", "a474802c0d90e29ff8c57a85dfe7f9e38fe189288899b0df168d48846dc5e3b7"],
  ]) {
    const text = readFileSync(path.join(process.cwd(), "public/service-notices", file), "utf8").replace(/\r\n/g, "\n");
    expect(createHash("sha256").update(text).digest("hex")).toBe(hash);
  }
});
