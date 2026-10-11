import { deleteApp, initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAuth, onAuthStateChanged, type Persistence } from "firebase/auth";
import { afterEach, describe, expect, it, vi } from "vitest";

// The Node SDK captures fetch during import, so block network before loading it.
const fetchAccount = vi.hoisted(() => {
  const mockedFetch = vi.fn();
  vi.stubGlobal("fetch", mockedFetch);
  return mockedFetch;
});
let app: FirebaseApp | undefined;

afterEach(async () => {
  if (app) await deleteApp(app);
  app = undefined;
  vi.unstubAllGlobals();
});

describe("Firebase Auth storage recovery", () => {
  it.each(["listener", "read"])("settles auth state when persistence %s fails", async (failure) => {
    // Use the installed SDK, with only the failing browser storage boundary replaced.
    class ClosingPersistence {
      readonly type = "LOCAL";
      readonly _shouldAllowMigration = false;
      async _isAvailable() { return true; }
      async _get() { throw new Error("Database is closing/hidden"); }
      async _set() { throw new Error("Database is closing/hidden"); }
      async _remove() { throw new Error("Database is closing/hidden"); }
      _addListener() {
        if (failure === "listener") throw new Error("Database is closing/hidden");
      }
      _removeListener() {}
    }

    app = initializeApp({ apiKey: "fixture-key", projectId: "fixture-project" }, `storage-${failure}`);
    const auth = initializeAuth(app, { persistence: ClosingPersistence as unknown as Persistence });
    const listener = vi.fn();
    const listenerError = vi.fn();
    const unsubscribe = onAuthStateChanged(auth, listener, listenerError);

    await expect(auth.authStateReady()).resolves.toBeUndefined();
    expect(listener).toHaveBeenCalledWith(null);
    expect(listenerError).not.toHaveBeenCalled();
    expect(auth.currentUser).toBeNull();
    unsubscribe();
  });

  it("settles restored auth after account lookup succeeds but saving the user fails", async () => {
    const storedUser = {
      uid: "fixture-user",
      email: "fixture@example.invalid",
      emailVerified: true,
      isAnonymous: false,
      providerData: [],
      stsTokenManager: {
        accessToken: "fixture-access-token",
        refreshToken: "fixture-refresh-token",
        expirationTime: Date.now() + 60_000,
      },
    };
    const saveUser = vi.fn(async () => { throw new Error("Database is closing/hidden"); });
    class ClosingWritePersistence {
      readonly type = "LOCAL";
      readonly _shouldAllowMigration = false;
      async _isAvailable() { return true; }
      async _get() { return storedUser; }
      _set = saveUser;
      async _remove() {}
      _addListener() {}
      _removeListener() {}
    }
    fetchAccount.mockImplementation(async () => new Response(JSON.stringify({
      users: [{
        localId: storedUser.uid,
        email: storedUser.email,
        emailVerified: true,
        passwordHash: "fixture-password-hash",
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchAccount);
    app = initializeApp({ apiKey: "fixture-key", projectId: "fixture-project" }, "storage-write");
    const auth = initializeAuth(app, { persistence: ClosingWritePersistence as unknown as Persistence });
    const listener = vi.fn();
    const listenerError = vi.fn();
    const unsubscribe = onAuthStateChanged(auth, listener, listenerError);

    await expect(auth.authStateReady()).resolves.toBeUndefined();
    expect(fetchAccount).toHaveBeenCalledExactlyOnceWith(
      "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=fixture-key",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ idToken: "fixture-access-token" }) }),
    );
    expect(saveUser).toHaveBeenCalledExactlyOnceWith(
      expect.any(String), expect.objectContaining({ uid: storedUser.uid }),
    );
    expect(fetchAccount.mock.invocationCallOrder[0]).toBeLessThan(saveUser.mock.invocationCallOrder[0]);
    expect(listener).toHaveBeenCalledExactlyOnceWith(null);
    expect(listenerError).not.toHaveBeenCalled();
    expect(auth.currentUser).toBeNull();
    unsubscribe();
  });
});
