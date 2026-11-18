import { render, screen, within } from "@testing-library/react";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PrivacyPage from "./page";

const request = vi.hoisted(() => ({ locale: "ko" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-syu-locale": request.locale }),
}));

beforeEach(() => {
  request.locale = "ko";
  vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-04T12:00:00+09:00"));
});

describe.each(["ko", "en"])("privacy policy (%s)", (locale) => {
  it("links the contents to all eleven articles in their existing order", async () => {
    request.locale = locale;
    const { container } = render(await PrivacyPage());
    const contents = screen.getByRole("navigation", {
      name: locale === "en" ? "Privacy policy contents" : "개인정보처리방침 목차",
    });
    const links = within(contents).getAllByRole("link");
    expect(links).toHaveLength(11);
    links.forEach((link, index) => {
      const id = `privacy-article-${index + 1}`;
      expect(link).toHaveAttribute("href", `#${id}`);
      const article = container.querySelector(`#${id}`);
      expect(article).toBeInTheDocument();
      expect(within(article as HTMLElement).getByRole("heading", { level: 2 }))
        .toHaveTextContent(locale === "en" ? `${index + 1}.` : `제${index + 1}조`);
    });

    const sharing = container.querySelector("#privacy-article-4") as HTMLElement;
    const groups = within(sharing).getAllByRole("heading", { level: 3 });
    expect(groups.map((heading) => heading.textContent)).toEqual(locale === "en" ? [
      "Sharing recruitment listings",
      "Processing entrusted to service providers",
      "Overseas processing for the roommate board",
      "Other external service processing",
    ] : [
      "모집글의 이용자 간 공개",
      "서비스 운영을 위한 처리위탁",
      "룸메이트 게시판의 국외 처리",
      "그 밖의 외부 서비스 처리",
    ]);
  });

  it("preserves the roommate retention, disclosure, transfer, and contact facts", async () => {
    request.locale = locale;
    const { container } = render(await PrivacyPage());
    const retention = container.querySelector("#privacy-article-2") as HTMLElement;
    const terms = retention.querySelectorAll("dt");
    expect(terms).toHaveLength(7);
    const retentionText = retention.textContent;
    if (locale === "en") {
      expect(retentionText).toContain("fixed 30 days");
      expect(retentionText).toContain("12 hours");
      expect(retentionText).toContain("up to 24 hours");
      expect(retentionText).toContain("30 days after submission");
      expect(retentionText).toContain("90 days after the last author or administrator action");
      expect(retentionText).toContain("up to 365 days");
      expect(retentionText).toContain("Signing out or deleting a listing does not delete this record");
      expect(screen.getByText(/Recipients: roommate board users verified with an @syuin.ac.kr/)).toBeInTheDocument();
      expect(screen.getByText(/Email addresses, authentication credentials, and internal author identifiers are not shown/)).toBeInTheDocument();
    } else {
      expect(retentionText).toContain("고정 30일");
      expect(retentionText).toContain("12시간");
      expect(retentionText).toContain("24시간까지");
      expect(retentionText).toContain("접수 후 30일");
      expect(retentionText).toContain("최종 조치 후 90일");
      expect(retentionText).toContain("최대 365일");
      expect(retentionText).toContain("로그아웃이나 모집글 삭제만으로 삭제되지 않으며");
      expect(screen.getByText(/제공받는 자: @syuin.ac.kr 이메일로 인증한/)).toBeInTheDocument();
      expect(screen.getByText(/이메일, 인증 비밀값과 내부 작성자 식별정보는 표시하지 않습니다/)).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { name: /Google LLC/, level: 4 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Vercel Inc. (privacy@vercel.com)", level: 4 })).toBeInTheDocument();
    expect(container).toHaveTextContent("asia-northeast3");
    expect(container).toHaveTextContent("iad1");
    expect(container).toHaveTextContent("singhic@outlook.kr");
    expect(container).toHaveTextContent(locale === "en" ? "November 3, 2026" : "2026년 11월 3일");
  });

  it("explains token verification and the limited analytics refusal method", async () => {
    request.locale = locale;
    const { container } = render(await PrivacyPage());
    const categories = container.querySelector("#privacy-article-3") as HTMLElement;
    const analyticsCookies = container.querySelector("#privacy-article-5") as HTMLElement;
    expect(categories).toHaveTextContent(locale === "en" ? "hashes stored in those feature records" : "서버의 해당 기능 문서에는 토큰의 해시");
    expect(categories).not.toHaveTextContent("서버에 전송되지 않습니다");
    expect(analyticsCookies).toHaveTextContent("_ga_<id>");
    expect(analyticsCookies).toHaveTextContent(locale === "en" ? "clearing cookies alone does not stop all analytics requests" : "쿠키 삭제만으로 모든 분석 요청이 중단되지는 않습니다");
    expect(within(analyticsCookies).getByRole("link", { name: locale === "en" ? "Analytics Opt-out Browser Add-on" : "애널리틱스 차단 브라우저 부가 기능" })).toHaveAttribute("href", `https://tools.google.com/dlpage/gaoptout?hl=${locale}`);
    expect(container).toHaveTextContent(locale === "en" ? "the person submitting a campus tip" : "제보자가 입력한 추가 메모");
    expect(container).not.toHaveTextContent("Hobby");
    const rights = container.querySelector("#privacy-article-8") as HTMLElement;
    expect(rights).toHaveTextContent(locale === "en" ? "footer's Contact the site button" : "페이지 하단의 ‘사이트 문의하기’ 버튼");
    expect(rights).not.toHaveTextContent(locale === "en" ? "contact page" : "사이트 문의 페이지");
    const changes = container.querySelector("#privacy-article-11") as HTMLElement;
    expect(within(changes).getByRole("link", { name: locale === "en" ? "Policy clarification notice and Terms amendment" : "설명 정정 및 이용약관 개정 공지" })).toHaveAttribute("href", `${locale === "en" ? "/en" : ""}/service/notices/021-policy-clarifications`);
  });

  it.each([
    ["2026-11-04T12:00:00+09:00", false],
    ["2026-12-04T23:59:59.999+09:00", false],
    ["2026-12-05T00:00:00+09:00", true],
  ] as const)("changes inquiry purpose and retention at the announced Korean-time boundary: %s", async (now, effective) => {
    request.locale = locale;
    vi.spyOn(Date, "now").mockReturnValue(Date.parse(now));
    const { container } = render(await PrivacyPage());
    const notice = screen.getByRole("complementary", { name: locale === "en" ? "Submission retention amendment" : "문의·제보 보유기간 개정" });
    expect(notice).toHaveTextContent(locale === "en" ? "December 5, 2026" : "2026년 12월 5일");
    expect(notice).toHaveTextContent(locale === "en" ? "one year after completion or rejection" : "완료·기각 후 원문과 포함된 AI 분류 결과를 1년");
    expect(notice).toHaveTextContent(locale === "en" ? "does not authorize extending retention of existing submissions" : "이 공지만으로 기존 자료의 보존을 연장하지 않습니다");
    const purposes = container.querySelector("#privacy-article-1") as HTMLElement;
    const retention = container.querySelector("#privacy-article-2") as HTMLElement;
    const oldPeriod = locale === "en" ? "retained until the review or service-improvement purpose is fulfilled" : "서비스 개선 검토 목적 달성 시까지 보존하며";
    const newPurpose = locale === "en" ? "Referring to previous questions and suggestions for one year" : "완료·기각 후 1년 동안 어떤 질문·제보가 있었는지";
    if (effective) {
      expect(purposes).toHaveTextContent(newPurpose);
      expect(retention).not.toHaveTextContent(oldPeriod);
      expect(retention).not.toHaveTextContent("운영자 검토 목적 달성 시까지 원 접수");
      expect(retention).toHaveTextContent(locale === "en" ? "There is no automatic purge" : "자동 파기는 하지 않습니다");
      expect(retention).toHaveTextContent(locale === "en" ? "does not make it anonymous" : "익명 자료가 되지는 않습니다");
      expect(retention).toHaveTextContent(locale === "en" ? "instead of inventing a date" : "날짜를 임의로 만들지 않습니다");
      expect(retention).toHaveTextContent(locale === "en" ? "manually deletes the original and included AI results" : "원문과 포함된 AI 결과를 수동으로 파기");
    } else {
      expect(purposes).not.toHaveTextContent(newPurpose);
      expect(retention).toHaveTextContent(oldPeriod);
      if (locale === "ko") expect(retention).toHaveTextContent("운영자 검토 목적 달성 시까지 원 접수");
      expect(retention).not.toHaveTextContent(locale === "en" ? "one year to refer" : "원문과 포함된 AI 분류 결과를 1년");
    }
    const changes = container.querySelector("#privacy-article-11") as HTMLElement;
    expect(within(changes).getByRole("link", { name: locale === "en" ? "Inquiry and suggestion retention amendment" : "문의·제보 보유기간 개정 공지" })).toHaveAttribute("href", `${locale === "en" ? "/en" : ""}/service/notices/022-submission-retention`);
  });
});

it.each([
  ["021-policy-clarifications.md", "30290817af51624b5c4f4189b3b7f9da723d648e24eeb03b69fdf74ee1984118"],
  ["en/021-policy-clarifications.md", "4eae30436cdf47006baa82968fa2df5cb407f9990a899ab622403bc18a1131cc"],
])("preserves the prior clarification notice unchanged: %s", (file, hash) => {
  const text = readFileSync(path.join(process.cwd(), "public/service-notices", file), "utf8").replace(/\r\n/g, "\n");
  expect(createHash("sha256").update(text).digest("hex")).toBe(hash);
});
