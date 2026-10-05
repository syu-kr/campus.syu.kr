import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ getApps: vi.fn(), initializeApp: vi.fn(), getAuth: vi.fn(), setPersistence: vi.fn(), signOut: vi.fn() }));
vi.mock("firebase/app", () => ({ getApps: mocks.getApps, initializeApp: mocks.initializeApp }));
vi.mock("firebase/auth", () => ({ getAuth: mocks.getAuth, inMemoryPersistence: "memory", setPersistence: mocks.setPersistence, signOut: mocks.signOut }));
import { clearRoommateAuth, getRoommateAuth } from "./firebaseRoommates";

describe("isolated student auth", () => {
  it("uses a named Firebase app with memory persistence and signs out only that app", async () => {
    const defaultApp = { name: "[DEFAULT]" }; const studentApp = { name: "syu-roommates" }; const auth = { currentUser: null };
    mocks.getApps.mockReturnValue([defaultApp]); mocks.initializeApp.mockReturnValue(studentApp); mocks.getAuth.mockReturnValue(auth);
    expect(await getRoommateAuth()).toBe(auth); expect(await getRoommateAuth()).toBe(auth);
    expect(mocks.initializeApp).toHaveBeenCalledTimes(1); expect(mocks.initializeApp.mock.calls[0][1]).toBe("syu-roommates");
    expect(mocks.getAuth).toHaveBeenCalledWith(studentApp); expect(mocks.getAuth).not.toHaveBeenCalledWith(defaultApp);
    expect(mocks.setPersistence).toHaveBeenCalledWith(auth, "memory");
    await clearRoommateAuth(); expect(mocks.signOut).toHaveBeenCalledWith(auth);
  });
});
