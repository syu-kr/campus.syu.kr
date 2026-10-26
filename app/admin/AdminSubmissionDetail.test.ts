import { describe, expect, it } from "vitest";
import { AdminRequestError, getAdminErrorMessage, readAdminApiResponse } from "./AdminSubmissionDetail";

describe("admin recovery messages", () => {
  it("preserves operator instructions but hides raw SDK and network exceptions", () => {
    expect(getAdminErrorMessage(new AdminRequestError("다시 로그인해주세요"), "retry")).toBe("다시 로그인해주세요");
    expect(getAdminErrorMessage(new TypeError("Firebase: internal network trace"), "retry")).toBe("retry");
  });
  it("preserves a structured permission rejection", async () => {
    await expect(readAdminApiResponse(Response.json({ error: "관리자 권한이 필요합니다" }, { status: 403 })))
      .rejects.toThrow("관리자 권한이 필요합니다");
  });
  it("does not accept malformed successful responses", async () => {
    await expect(readAdminApiResponse(Response.json(null))).rejects.toThrow();
    await expect(readAdminApiResponse(new Response("<html>private trace</html>")))
      .rejects.toThrow("처리 결과를 확인하지 못했습니다");
  });
});
