import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { app, auth, messaging, initializeApp, getAuth, getMessaging, onMessage, setNotificationHandler } = vi.hoisted(() => ({
  app: {},
  auth: {},
  messaging: {},
  initializeApp: vi.fn(),
  getAuth: vi.fn(),
  getMessaging: vi.fn(),
  onMessage: vi.fn(),
  setNotificationHandler: vi.fn(),
}));

vi.mock("firebase/app", () => ({ initializeApp }));
vi.mock("firebase/auth", () => ({ getAuth }));
vi.mock("firebase/messaging", () => ({ getMessaging, onMessage }));
vi.mock("@/app/components/NotificationModal", () => ({ setNotificationHandler }));

describe("Firebase messaging initialization", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
    initializeApp.mockReturnValue(app);
    getAuth.mockReturnValue(auth);
    getMessaging.mockReturnValue(messaging);
    vi.stubGlobal("navigator", { serviceWorker: {} });
    for (const key of ["API_KEY", "AUTH_DOMAIN", "PROJECT_ID", "STORAGE_BUCKET", "MESSAGING_SENDER_ID", "APP_ID"]) {
      vi.stubEnv(`NEXT_PUBLIC_FIREBASE_${key}`, "test-config");
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each([
    Object.assign(new Error("messaging unavailable"), { code: "messaging/unsupported-browser" }),
    undefined,
  ])("preserves Auth and the original synchronous Messaging failure (%s)", async (error) => {
    getMessaging.mockImplementation(() => { throw error; });

    const firebase = await import("./firebase");

    expect(firebase.auth).toBe(auth);
    expect(getAuth).toHaveBeenCalledExactlyOnceWith(app);
    expect(firebase.messaging).toBeNull();
    expect(firebase.messagingInitializationFailure).toEqual({ error });
    expect(firebase.messagingInitializationFailure?.error).toBe(error);
    firebase.setupForegroundNotifications();
    expect(onMessage).not.toHaveBeenCalled();
    expect(setNotificationHandler).not.toHaveBeenCalled();
  });

  it("keeps successful Messaging setup and registers the foreground handler only once", async () => {
    const firebase = await import("./firebase");

    expect(firebase.auth).toBe(auth);
    expect(firebase.messaging).toBe(messaging);
    expect(firebase.messagingInitializationFailure).toBeUndefined();
    expect(getMessaging).toHaveBeenCalledExactlyOnceWith(app);
    firebase.setupForegroundNotifications();
    firebase.setupForegroundNotifications();
    expect(onMessage).toHaveBeenCalledExactlyOnceWith(messaging, expect.any(Function));

    const handleMessage = onMessage.mock.calls[0][1];
    handleMessage({ notification: { title: "Test", body: "Body", icon: "/icon.png" }, data: { url: "/" } });
    expect(setNotificationHandler).toHaveBeenCalledExactlyOnceWith({
      title: "Test", body: "Body", icon: "/icon.png", url: "/",
    });
  });

  it("does not classify an environment without service workers as an initialization failure", async () => {
    vi.stubGlobal("navigator", {});

    const firebase = await import("./firebase");

    expect(firebase.auth).toBe(auth);
    expect(firebase.messaging).toBeNull();
    expect(firebase.messagingInitializationFailure).toBeUndefined();
    expect(getMessaging).not.toHaveBeenCalled();
    firebase.setupForegroundNotifications();
    expect(onMessage).not.toHaveBeenCalled();
  });
});
