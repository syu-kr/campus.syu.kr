import { describe, expect, it } from "vitest";
import {
  encodeSubmissionCursor,
  readSubmissionCursor,
  type SubmissionCursor,
} from "./route";

describe("admin submission pagination cursor", () => {
  it("round-trips independent collection positions", () => {
    const cursor: SubmissionCursor = {
      inquiry: {
        createdAt: "2026-07-25T01:00:00.000Z",
        id: "inquiry_1",
      },
      campusTip: {
        createdAt: "2026-07-24T02:00:00.000Z",
        id: "tip_1",
      },
    };

    expect(readSubmissionCursor(encodeSubmissionCursor(cursor))).toEqual(
      cursor,
    );
  });

  it("rejects a malformed cursor instead of restarting from page one", () => {
    expect(() => readSubmissionCursor("not-a-valid-cursor")).toThrow(
      "페이지 커서가 올바르지 않습니다",
    );
  });

  it("rejects cursor document identifiers outside the Firestore id contract", () => {
    const invalidCursor = Buffer.from(
      JSON.stringify({
        inquiry: {
          createdAt: "2026-07-25T01:00:00.000Z",
          id: "invalid/id",
        },
      }),
      "utf8",
    ).toString("base64url");

    expect(() => readSubmissionCursor(invalidCursor)).toThrow(
      "페이지 커서가 올바르지 않습니다",
    );
  });
});
