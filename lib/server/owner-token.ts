import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export function createOwnerToken() {
  const token = randomBytes(32).toString("base64url");

  return { token, hash: hashOwnerToken(token) };
}

export function matchesOwnerToken(token: string, expectedHash: unknown) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || typeof expectedHash !== "string") {
    return false;
  }

  const actual = Buffer.from(hashOwnerToken(token));
  const expected = Buffer.from(expectedHash);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function hashOwnerToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
