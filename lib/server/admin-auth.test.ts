import { describe, expect, it } from "vitest";
import { getAdminAuthorizationFailure } from "./admin-auth";

const allowedEmails = ["admin@example.com"];

describe("getAdminAuthorizationFailure", () => {
  it("rejects an unverified allowlisted email", () => {
    expect(
      getAdminAuthorizationFailure(
        { email: "admin@example.com", email_verified: false },
        allowedEmails,
      ),
    ).toBe("email-unverified");
  });

  it("rejects a verified email outside the allowlist", () => {
    expect(
      getAdminAuthorizationFailure(
        { email: "user@example.com", email_verified: true },
        allowedEmails,
      ),
    ).toBe("not-allowed");
  });

  it("accepts a verified allowlisted email case-insensitively", () => {
    expect(
      getAdminAuthorizationFailure(
        { email: "ADMIN@EXAMPLE.COM", email_verified: true },
        allowedEmails,
      ),
    ).toBeNull();
  });
});
