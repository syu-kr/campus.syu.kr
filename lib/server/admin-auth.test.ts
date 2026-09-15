import { describe, expect, it } from "vitest";
import { getAdminAuthorizationFailure } from "./admin-auth";

const allowedEmails = ["admin@example.com"];

describe("getAdminAuthorizationFailure", () => {
  it("rejects an allowlisted email until it is verified", () => {
    const decodedToken = {
      email: "admin@example.com",
      email_verified: false,
    };

    expect(
      getAdminAuthorizationFailure(decodedToken, allowedEmails),
    ).toBe("email-not-verified");
  });

  it("rejects an email outside the allowlist", () => {
    expect(
      getAdminAuthorizationFailure(
        { email: "user@example.com", email_verified: true },
        allowedEmails,
      ),
    ).toBe("not-allowed");
  });

  it("accepts an allowlisted email case-insensitively", () => {
    expect(
      getAdminAuthorizationFailure(
        { email: " ADMIN@EXAMPLE.COM ", email_verified: true },
        allowedEmails,
      ),
    ).toBeNull();
  });

  it("rejects a token without an email", () => {
    expect(getAdminAuthorizationFailure({ email_verified: true }, allowedEmails)).toBe(
      "not-allowed",
    );
  });
});
