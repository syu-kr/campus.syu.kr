import { describe, expect, it } from "vitest";

import { createOwnerToken, matchesOwnerToken } from "./owner-token";

describe("owner token", () => {
  it("stores only a hash and rejects a different token", () => {
    const owner = createOwnerToken();

    expect(owner.hash).not.toBe(owner.token);
    expect(matchesOwnerToken(owner.token, owner.hash)).toBe(true);
    expect(matchesOwnerToken("a".repeat(43), owner.hash)).toBe(false);
  });
});
