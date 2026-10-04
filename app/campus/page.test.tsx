import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CampusPage from "./page";

const request = vi.hoisted(() => ({ cookie: "", locale: "ko" }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-syu-locale": request.locale }),
  cookies: async () => ({ get: () => request.cookie ? { value: request.cookie } : undefined }),
}));
vi.mock("next/link", () => ({ default: ({ prefetch, ...props }: ComponentProps<"a"> & { prefetch?: boolean }) => { void prefetch; return <a {...props} />; } }));
vi.mock("@/lib/server/roommate-auth", () => { throw new Error("Campus navigation must not load the Firebase authentication module."); });

beforeEach(() => { vi.stubEnv("ROOMMATES_ENABLED", "true"); request.cookie = ""; request.locale = "ko"; });
afterEach(() => { vi.unstubAllEnvs(); });

describe("campus roommate entry", () => {
  it("takes a browser without a session cookie directly to email verification", async () => {
    render(await CampusPage());
    expect(screen.getByRole("link", { name: /룸메이트 구하기/ })).toHaveAttribute("href", "/campus/roommates/verify?next=%2Fcampus%2Froommates");
  });
  it("preserves the selected language in the verification destination", async () => {
    request.locale = "en";
    render(await CampusPage());
    expect(screen.getByRole("link", { name: /Find a Roommate/ })).toHaveAttribute("href", "/en/campus/roommates/verify?next=%2Fen%2Fcampus%2Froommates");
  });
  it("routes a cookie-bearing browser to the protected board for fresh authentication", async () => {
    request.cookie = "unverified-routing-hint";
    render(await CampusPage());
    expect(screen.getByRole("link", { name: /룸메이트 구하기/ })).toHaveAttribute("href", "/campus/roommates");
  });
});
