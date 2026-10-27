import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/lib/server/home-data", () => ({ getHomeCafeteriaSnapshot: vi.fn(async () => ({ menus: [], checkedAt: null, stale: false })) }));
vi.mock("@/lib/server/public-data-storage", () => ({ publicDataFirebaseEnabled: () => process.env.PUBLIC_DATA_BACKEND === "firebase" }));
vi.mock("@/app/features/cafeteria/CafeteriaPageClient", () => ({ CafeteriaPageClient: () => null }));

import CafeteriaPage from "./page";

afterEach(() => vi.unstubAllEnvs());

it.each(["", "pages", "firebase"])("passes only the runtime backend choice to the cafeteria client (%s)", async (backend) => {
  vi.stubEnv("PUBLIC_DATA_BACKEND", backend);
  vi.stubEnv("NEXT_PUBLIC_CAFETERIA_JSON_URL", "");
  const page = await CafeteriaPage();
  expect(page.props.firebaseDataEnabled).toBe(backend === "firebase");
  expect(page.props.initialSnapshot).toEqual({ menus: [], checkedAt: null, stale: false });
});
