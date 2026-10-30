// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const sdk = vi.hoisted(() => {
  const app = { name: "[DEFAULT]", options: { credential: {} } };
  const grpcRead = vi.fn(), restRead = vi.fn();
  const grpcRef = { get: grpcRead }, restRef = { get: restRead };
  return { app, apps: [app], grpcRead, restRead, grpcRef, restRef,
    grpc: { collection: vi.fn(() => ({ doc: vi.fn(() => grpcRef) })) },
    rest: { collection: vi.fn(() => ({ doc: vi.fn(() => restRef) })) },
    initialize: vi.fn(), parse: vi.fn((value: unknown) => value) };
});
vi.mock("../firebaseAdmin", () => ({ initializeFirebaseAdmin: () => sdk.app }));
vi.mock("firebase-admin/app", () => ({ getApps: () => sdk.apps, initializeApp: sdk.initialize }));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: () => sdk.grpc, initializeFirestore: vi.fn(() => sdk.rest) }));
vi.mock("firebase-admin/storage", () => ({ getStorage: () => ({ bucket: () => ({}) }) }));
vi.mock("../public-data-snapshot", () => ({ parsePublicDataManifest: sdk.parse }));
import { initializeFirestore } from "firebase-admin/firestore";
import { firebasePublicDataStore } from "./public-data-storage";
beforeEach(() => {
  vi.clearAllMocks(); sdk.apps.splice(1);
  sdk.initialize.mockImplementation((options, name) => { const app = { options, name }; sdk.apps.push(app); return app; });
  vi.stubEnv("PUBLIC_DATA_STORAGE_BUCKET", "transport-test-bucket");
  const data = { exists: true, data: () => ({ revision: 2, manifest: { version: "v2" } }) };
  sdk.grpcRead.mockReset().mockResolvedValue(data); sdk.restRead.mockReset().mockResolvedValue(data);
});
afterEach(() => vi.unstubAllEnvs());

it("keeps default reads on gRPC and uses one isolated REST app for home reads", async () => {
  const expected = { revision: 2, manifest: { version: "v2" } };
  expect(await firebasePublicDataStore().readActive()).toEqual(expected);
  expect(initializeFirestore).not.toHaveBeenCalled();
  expect(await firebasePublicDataStore(true).readActive()).toEqual(expected);
  expect(await firebasePublicDataStore(true).readActive()).toEqual(expected);
  expect(sdk.initialize).toHaveBeenCalledExactlyOnceWith(sdk.app.options, "home-public-manifest");
  expect(initializeFirestore).toHaveBeenCalledWith(sdk.apps[1], { preferRest: true });
  expect(sdk.grpcRead).toHaveBeenCalledTimes(1); expect(sdk.restRead).toHaveBeenCalledTimes(2);
  expect(sdk.parse).toHaveBeenCalledTimes(3);
});

it("preserves missing document and invalid revision checks on both transports", async () => {
  for (const rest of [false, true]) {
    const read = rest ? sdk.restRead : sdk.grpcRead;
    read.mockResolvedValueOnce({ exists: false });
    expect(await firebasePublicDataStore(rest).readActive()).toBeNull();
    read.mockResolvedValueOnce({ exists: true, data: () => ({ revision: 0 }) });
    await expect(firebasePublicDataStore(rest).readActive()).rejects.toThrow("Invalid active public data revision");
  }
});

it("propagates REST read and parser failures for uncached recovery", async () => {
  const error = new Error("offline"); sdk.restRead.mockRejectedValueOnce(error);
  await expect(firebasePublicDataStore(true).readActive()).rejects.toBe(error);
  sdk.parse.mockImplementationOnce(() => { throw new Error("invalid manifest"); });
  await expect(firebasePublicDataStore(true).readActive()).rejects.toThrow("invalid manifest");
});
