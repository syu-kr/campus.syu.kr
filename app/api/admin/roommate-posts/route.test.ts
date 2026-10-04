import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import { AdminAuthError } from "@/lib/server/admin-auth";
import { GET, PATCH } from "./route";
import { GET as reportGet, PATCH as reportPatch } from "../roommate-reports/route";

const mocks = vi.hoisted(() => ({ requireAdmin: vi.fn(), getFirestore: vi.fn() }));
vi.mock("@/lib/server/admin-auth", async (actual) => ({ ...await actual<typeof import("@/lib/server/admin-auth")>(), requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/server/firestore", async () => { const { Timestamp } = await import("firebase-admin/firestore"); return { getFirestore: mocks.getFirestore, admin: { firestore: { Timestamp } } }; });
beforeEach(() => { vi.clearAllMocks(); mocks.requireAdmin.mockRejectedValue(new AdminAuthError("관리자 권한이 없습니다", 403)); });
it.each([["post GET", GET], ["post PATCH", PATCH], ["report GET", reportGet], ["report PATCH", reportPatch]])("%s rejects a student identity before any database access with private cache headers", async (_, handler) => {
  const response = await handler(new NextRequest("https://example.test/api/admin/roommate-posts"));
  expect(response.status).toBe(403);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(mocks.getFirestore).not.toHaveBeenCalled();
});
