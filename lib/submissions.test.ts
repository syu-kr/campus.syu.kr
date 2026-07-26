import { describe, expect, it } from "vitest";
import {
  normalizeCampusTipSuggestion,
  normalizeSiteInquiry,
} from "./submissions";
import { SubmissionValidationError } from "@/types/submissions";

function captureValidationError(run: () => unknown) {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(SubmissionValidationError);
    return error as SubmissionValidationError;
  }

  throw new Error("Expected submission validation to fail");
}

describe("submission input length validation", () => {
  it("rejects an oversized inquiry instead of silently truncating it", () => {
    const error = captureValidationError(() =>
      normalizeSiteInquiry({
        type: "bug",
        title: "로그인 오류",
        message: "가".repeat(2001),
      }),
    );

    expect(error).toMatchObject({
      code: "MESSAGE_TOO_LONG",
      field: "message",
      message: "문의 내용은 2000자 이하로 입력해주세요",
    });
  });

  it("rejects more than eight campus-tip tags", () => {
    const error = captureValidationError(() =>
      normalizeCampusTipSuggestion({
        title: "캠퍼스 팁",
        category: "school",
        description: "설명",
        tags: Array.from({ length: 9 }, (_, index) => `태그${index}`),
      }),
    );

    expect(error).toMatchObject({
      code: "TOO_MANY_TAGS",
      field: "tags",
      message: "태그는 최대 8개까지 입력할 수 있습니다",
    });
  });

  it("rejects an oversized tag instead of storing a shortened value", () => {
    const error = captureValidationError(() =>
      normalizeCampusTipSuggestion({
        title: "캠퍼스 팁",
        category: "school",
        description: "설명",
        tags: ["가".repeat(25)],
      }),
    );

    expect(error).toMatchObject({
      code: "TAG_TOO_LONG",
      field: "tags",
      message: "태그는 각각 24자 이하로 입력해주세요",
    });
  });
});
