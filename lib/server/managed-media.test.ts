// @vitest-environment node
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const storage = vi.hoisted(() => ({ file: vi.fn(), save: vi.fn(), metadata: vi.fn(), download: vi.fn(), initialize: vi.fn(), bucket: vi.fn(), bucketMetadata: vi.fn() }));
vi.mock("@/lib/firebaseAdmin", () => ({ initializeFirebaseAdmin: storage.initialize }));
vi.mock("firebase-admin/storage", () => ({ getStorage: () => ({ bucket: storage.bucket }) }));
import { encodeManagedImage, readManagedImage, saveManagedImage, isManagedMediaAvailable, MAX_MEDIA_INPUT } from "./managed-media";

const id = "f07dba03-8cda-4a95-b8cc-111111111111";
beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "fixture.appspot.com");
  vi.stubEnv("MANAGED_CONTENT_STORAGE_BUCKET", "");vi.stubEnv("FIREBASE_SERVICE_ACCOUNT", "fixture");
  storage.bucket.mockReset().mockReturnValue({ file: storage.file, getMetadata: storage.bucketMetadata });storage.bucketMetadata.mockReset().mockResolvedValue([{}]);
  storage.file.mockReset().mockReturnValue({ save: storage.save, getMetadata: storage.metadata, download: storage.download });
  storage.save.mockReset().mockResolvedValue(undefined);storage.metadata.mockReset();storage.download.mockReset();storage.initialize.mockClear();
});
afterEach(() => { vi.unstubAllEnvs();vi.useRealTimers(); });

describe("banner image trust boundary", () => {
  it("turns actual PNG pixels into bounded metadata-free WebP and stores only an immutable UUID path", async () => {
    const image = await sharp({ create: { width: 80, height: 40, channels: 3, background: "red" } }).withMetadata({ exif: { IFD0: { Artist: "Private fixture author" } } }).png().toBuffer();
    const encoded = await encodeManagedImage(image);
    const metadata = await sharp(encoded.data).metadata();
    expect(metadata.format).toBe("webp");expect(metadata.exif).toBeUndefined();expect(metadata.width).toBe(80);
    const saved = await saveManagedImage(image);
    expect(saved.url).toMatch(/^\/api\/content-media\/[a-f0-9-]{36}$/);
    expect(storage.file.mock.calls[0][0]).toMatch(/^managed-content\/[a-f0-9-]{36}\.webp$/);
    expect(storage.save.mock.calls[0][1]).toMatchObject({ resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType: "image/webp" } });
  });
  it("scales oversized dimensions and accepts JPEG/WebP signatures without trusting file names", async () => {
    for (const format of ["jpeg", "webp"] as const) {
      const source = await sharp({ create: { width: 2000, height: 100, channels: 3, background: "white" } })[format]().toBuffer();
      const result = await encodeManagedImage(source);expect(result.width).toBe(1920);expect(result.height).toBe(96);
    }
  });
  it.each(["<svg onload=alert(1)></svg>", "GIF89a", "not-an-image"])("rejects unsupported content before storage writes", async text => {
    await expect(saveManagedImage(new TextEncoder().encode(text))).rejects.toMatchObject({ status: 415 });
    expect(storage.save).not.toHaveBeenCalled();
  });
  it("rejects oversized input and decompression-sized pixel counts", async () => {
    await expect(encodeManagedImage(new Uint8Array(MAX_MEDIA_INPUT + 1))).rejects.toMatchObject({ status: 413 });
    const source = await sharp({ create: { width: 5001, height: 5000, channels: 3, background: "white" } }).png().toBuffer();
    await expect(encodeManagedImage(source)).rejects.toMatchObject({ status: 415 });
  });
  it("rejects invalid public paths before accessing the bucket and bounds stored content", async () => {
    await expect(readManagedImage("../private")).rejects.toMatchObject({ status: 404 });
    expect(storage.initialize).not.toHaveBeenCalled();
    storage.metadata.mockResolvedValue([{ contentType: "image/svg+xml", size: 5 }]);
    await expect(readManagedImage(id)).rejects.toMatchObject({ status: 404 });
    expect(storage.download).not.toHaveBeenCalled();
  });
  it("returns a stable content ETag and sanitizes missing/error storage responses", async () => {
    storage.metadata.mockResolvedValue([{ contentType: "image/webp", size: 4 }]);storage.download.mockResolvedValue([Buffer.from("webp")]);
    const result = await readManagedImage(id);expect(result.etag).toMatch(/^"[a-f0-9]{64}"$/);
    expect(storage.file).toHaveBeenCalledWith(`managed-content/${id}.webp`);
    storage.metadata.mockRejectedValueOnce({ code: 404 });await expect(readManagedImage(id)).rejects.toMatchObject({ status: 404 });
    storage.metadata.mockRejectedValueOnce(new Error("private bucket credential failure"));await expect(readManagedImage(id)).rejects.toMatchObject({ status: 503, message: "이미지를 불러오지 못했습니다." });
  });
  it("uses the server-only bucket override and caches a bounded read-only health probe", async () => {
    vi.stubEnv("MANAGED_CONTENT_STORAGE_BUCKET", "managed-override.appspot.com");
    expect(await isManagedMediaAvailable()).toBe(true);expect(await isManagedMediaAvailable()).toBe(true);
    expect(storage.bucket).toHaveBeenCalledWith("managed-override.appspot.com");expect(storage.bucketMetadata).toHaveBeenCalledTimes(1);expect(storage.save).not.toHaveBeenCalled();
  });
  it("reports missing, denied and timed-out buckets as unavailable without uploading", async () => {
    for (const code of [404, 403]) {
      vi.stubEnv("MANAGED_CONTENT_STORAGE_BUCKET", `unavailable-${code}.appspot.com`);storage.bucketMetadata.mockRejectedValueOnce({ code });
      expect(await isManagedMediaAvailable()).toBe(false);
    }
    vi.useFakeTimers();vi.stubEnv("MANAGED_CONTENT_STORAGE_BUCKET", "unavailable-timeout.appspot.com");storage.bucketMetadata.mockImplementationOnce(() => new Promise(() => {}));
    const result = isManagedMediaAvailable();await vi.advanceTimersByTimeAsync(1000);expect(await result).toBe(false);expect(storage.save).not.toHaveBeenCalled();
  });
  it("does not initialize credentials when a bucket or service account is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "");expect(await isManagedMediaAvailable()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET", "fixture.appspot.com");vi.stubEnv("FIREBASE_SERVICE_ACCOUNT", "");expect(await isManagedMediaAvailable()).toBe(false);expect(storage.initialize).not.toHaveBeenCalled();
  });
});
