import { describe, expect, it } from "vitest";
import {
  redactPersonalInfo,
  sanitizeAdminSubmissionAiInput,
  sanitizeUrlForAi,
} from "./admin-submission-ai";

describe("admin submission AI data minimization", () => {
  it("redacts common Korean contact and identifier formats", () => {
    const redacted = redactPersonalInfo(
      "성명: 홍길동, 학번 2026-123456, 전화 010-1234-5678, user@example.com",
    );

    expect(redacted).not.toContain("홍길동");
    expect(redacted).not.toContain("2026-123456");
    expect(redacted).not.toContain("010-1234-5678");
    expect(redacted).not.toContain("user@example.com");
  });

  it("redacts a street address while preserving the issue description", () => {
    expect(
      redactPersonalInfo("경기도 남양주시 별내로 123에서 셔틀이 멈췄습니다"),
    ).toBe("[주소 생략]에서 셔틀이 멈췄습니다");
  });

  it("removes URL query strings and fragments before AI processing", () => {
    expect(
      sanitizeUrlForAi(
        "https://campus.syu.kr/report?student=20261234#private",
      ),
    ).toBe("https://campus.syu.kr/report");
  });

  it("does not include contact-only fields in the sanitized AI input", () => {
    const sanitized = sanitizeAdminSubmissionAiInput({
      kind: "inquiry",
      title: "작성자 김삼육 로그인 오류",
      type: "bug",
      message: "계정: student_123 로그인이 되지 않습니다",
      pageUrl: "https://campus.syu.kr/login?email=user@example.com",
    });

    expect(JSON.stringify(sanitized)).not.toContain("김삼육");
    expect(JSON.stringify(sanitized)).not.toContain("student_123");
    expect(JSON.stringify(sanitized)).not.toContain("user@example.com");
  });
});
