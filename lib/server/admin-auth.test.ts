import { describe, expect, it } from "vitest";
import { getAdminAuthorizationFailure } from "./admin-auth";

const allowedEmails = ["admin@example.com"];

describe("getAdminAuthorizationFailure", () => {
  it("accepts an allowlisted email regardless of its verification claim", () => {
    const decodedToken = {
      email: "admin@example.com",
      email_verified: false,
    };

    expect(
      getAdminAuthorizationFailure(decodedToken, allowedEmails),
    ).toBeNull();
  });

  it("rejects an email outside the allowlist", () => {
    expect(
      getAdminAuthorizationFailure(
        { email: "user@example.com" },
        allowedEmails,
      ),
    ).toBe("not-allowed");
  });

  it("accepts an allowlisted email case-insensitively", () => {
    expect(
      getAdminAuthorizationFailure(
        { email: " ADMIN@EXAMPLE.COM " },
        allowedEmails,
      ),
    ).toBeNull();
  });

  it("rejects a token without an email", () => {
    expect(getAdminAuthorizationFailure({}, allowedEmails)).toBe(
      "not-allowed",
    );
  });
});
