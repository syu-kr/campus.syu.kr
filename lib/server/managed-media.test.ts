// @vitest-environment node
import sharp from "sharp";
import { createHash } from "node:crypto";
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
    expect(storage.save.mock.calls[0][1]).toMatchObject({ resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType: "image/webp", cacheControl: "public, max-age=0, s-maxage=60, must-revalidate" } });
    expect(storage.save.mock.calls[0][1].metadata.metadata.sha256).toBe(createHash("sha256").update(storage.save.mock.calls[0][0]).digest("hex"));
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
  it("skips downloading only when the saved hash and GCS generation match the body-issued validator", async () => {
    const sha256 = "a".repeat(64);
    storage.metadata.mockResolvedValue([{ contentType: "image/webp", size: 4, generation: "1001", metadata: { sha256 } }]);
    expect(await readManagedImage(id, `"${sha256}-g1001"`)).toEqual({ data: null, etag: `"${sha256}-g1001"` });
    expect(storage.metadata).toHaveBeenCalledTimes(1);expect(storage.download).not.toHaveBeenCalled();
  });
  it("checks current object existence again before accepting a previously valid ETag", async () => {
    const data = Buffer.from("webp"), sha256 = createHash("sha256").update(data).digest("hex");
    storage.metadata.mockResolvedValueOnce([{ contentType: "image/webp", size: data.length, generation: "1001", metadata: { sha256 } }]).mockRejectedValueOnce({ code: 404 });
    storage.download.mockResolvedValueOnce([data]);
    const image = await readManagedImage(id);
    await expect(readManagedImage(id, image.etag)).rejects.toMatchObject({ status: 404 });
    expect(storage.metadata).toHaveBeenCalledTimes(2);expect(storage.download).toHaveBeenCalledTimes(1);
  });
  it.each([null, '"different"'])("keeps full integrity validation when a validator is absent or different: %s", async validator => {
    const data = Buffer.from("webp"), sha256 = createHash("sha256").update(data).digest("hex");
    storage.metadata.mockResolvedValue([{ contentType: "image/webp", size: data.length, metadata: { sha256 } }]);
    storage.download.mockResolvedValue([data]);
    expect(await readManagedImage(id, validator)).toEqual({ data, etag: `"${sha256}"` });
    expect(storage.download).toHaveBeenCalledExactlyOnceWith({ validation: "crc32c" });
  });
  it.each([undefined, "invalid", "a".repeat(63), 123])("falls back to the downloaded bytes for missing or invalid saved hashes: %s", async sha256 => {
    const data = Buffer.from("webp"), etag = `"${createHash("sha256").update(data).digest("hex")}"`;
    storage.metadata.mockResolvedValue([{ contentType: "image/webp", size: data.length, metadata: { sha256 } }]);
    storage.download.mockResolvedValue([data]);
    expect(await readManagedImage(id, etag)).toEqual({ data, etag });
    expect(storage.download).toHaveBeenCalledExactlyOnceWith({ validation: "crc32c" });
  });
  it.each([undefined, "", "0", "invalid", 1001])("does not trust a saved hash without a valid GCS generation: %s", async generation => {
    const data = Buffer.from("webp"), sha256 = createHash("sha256").update(data).digest("hex");
    storage.metadata.mockResolvedValue([{ contentType: "image/webp", size: data.length, generation, metadata: { sha256 } }]);
    storage.download.mockResolvedValue([data]);
    expect(await readManagedImage(id, `"${sha256}"`)).toEqual({ data, etag: `"${sha256}"` });
    expect(storage.download).toHaveBeenCalledExactlyOnceWith({ validation: "crc32c" });
    expect(storage.file).toHaveBeenCalledTimes(1);
  });
  it("downloads an overwritten object even when its custom hash still describes the previous body", async () => {
    const oldHash = createHash("sha256").update("old!").digest("hex"), data = Buffer.from("new!");
    const hash = createHash("sha256").update(data).digest("hex");
    storage.metadata.mockResolvedValue([{ contentType: "image/webp", size: data.length, generation: "1002", metadata: { sha256: oldHash } }]);
    storage.download.mockResolvedValue([data]);
    expect(await readManagedImage(id, `"${oldHash}-g1001"`)).toEqual({ data, etag: `"${hash}-g1002"` });
    expect(storage.file).toHaveBeenLastCalledWith(`managed-content/${id}.webp`, { generation: "1002" });
    expect(storage.download).toHaveBeenCalledExactlyOnceWith({ validation: "crc32c" });
  });
  it("migrates a bare legacy validator through full validation before returning the generation-bound ETag", async () => {
    const data = Buffer.from("webp"), sha256 = createHash("sha256").update(data).digest("hex");
    storage.metadata.mockResolvedValue([{ contentType: "image/webp", size: data.length, generation: "1001", metadata: { sha256 } }]);
    storage.download.mockResolvedValue([data]);
    expect(await readManagedImage(id, `"${sha256}"`)).toEqual({ data, etag: `"${sha256}-g1001"` });
    expect(storage.download).toHaveBeenCalledOnce();
  });
  it("pins the downloaded generation when the live object changes after metadata was read", async () => {
    const data = Buffer.from("old!"), sha256 = createHash("sha256").update(data).digest("hex");
    let liveData = data;
    const liveDownload = vi.fn(async () => [liveData]);
    storage.metadata.mockImplementationOnce(async () => {
      liveData = Buffer.from("new!");
      return [{ contentType: "image/webp", size: data.length, generation: "1001", metadata: { sha256 } }];
    });
    storage.file.mockImplementation((_key, options) => options?.generation === "1001"
      ? { download: storage.download }
      : { getMetadata: storage.metadata, download: liveDownload });
    storage.download.mockResolvedValue([data]);
    expect(await readManagedImage(id)).toEqual({ data, etag: `"${sha256}-g1001"` });
    expect(liveDownload).not.toHaveBeenCalled();
    expect(storage.download).toHaveBeenCalledExactlyOnceWith({ validation: "crc32c" });
  });
  it.each([
    { contentType: "image/svg+xml", size: 4 },
    { contentType: "image/webp", size: 0 },
    { contentType: "image/webp", size: 2 * 1024 * 1024 + 1 },
    { contentType: "image/webp", size: "invalid" },
  ])("rejects invalid object metadata before accepting a matching hash: %j", async metadata => {
    const sha256 = "a".repeat(64);
    storage.metadata.mockResolvedValue([{ ...metadata, metadata: { sha256 } }]);
    await expect(readManagedImage(id, `"${sha256}"`)).rejects.toMatchObject({ status: 404 });
    expect(storage.download).not.toHaveBeenCalled();
  });
  it("keeps rejecting downloaded data that does not match the validated size", async () => {
    storage.metadata.mockResolvedValue([{ contentType: "image/webp", size: 4 }]);storage.download.mockResolvedValue([Buffer.from("wrong-length")]);
    await expect(readManagedImage(id, '"different"')).rejects.toMatchObject({ status: 404 });
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
