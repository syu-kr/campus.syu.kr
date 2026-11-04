import { randomUUID, createHash } from "node:crypto";
import sharp from "sharp";
import { getStorage } from "firebase-admin/storage";
import { initializeFirebaseAdmin } from "@/lib/firebaseAdmin";
import { ApiError } from "./http";
import { isManagedMediaId } from "./managed-content";

export const MAX_MEDIA_INPUT = 5 * 1024 * 1024;
// shortcut: expiry-based withdrawal; add targeted CDN deletion if faster revocation is required.
export const MANAGED_MEDIA_CACHE_CONTROL = "public, max-age=0, s-maxage=60, must-revalidate";
const MAX_MEDIA_OUTPUT = 2 * 1024 * 1024;
function bucketName() { return process.env.MANAGED_CONTENT_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || ""; }
function managedMediaBucket() {
  const bucket = bucketName();
  if (!bucket || /[\s/\\]/.test(bucket)) throw new ApiError("이미지 저장소 설정을 확인해 주세요.", 503, undefined, "MEDIA_CONFIG_MISSING");
  initializeFirebaseAdmin();
  return getStorage().bucket(bucket);
}
let health: { bucket: string; expiresAt: number; promise: Promise<boolean> } | undefined;
/** A configured bucket name alone does not prove that uploads can reach a bucket. */
export function isManagedMediaAvailable(): Promise<boolean> {
  const name = bucketName();
  if (!name || !process.env.FIREBASE_SERVICE_ACCOUNT) return Promise.resolve(false);
  if (health && health.bucket === name && health.expiresAt > Date.now()) return health.promise;
  const promise = (async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        managedMediaBucket().getMetadata().then(() => true),
        new Promise<boolean>(resolve => { timer = setTimeout(() => resolve(false), 1000); }),
      ]);
    } catch { return false; }
    finally { clearTimeout(timer); }
  })();
  health = { bucket: name, expiresAt: Date.now() + 60_000, promise };
  return promise;
}
function signature(bytes: Uint8Array) {
  const data = Buffer.from(bytes);
  if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "png";
  if (data[0] === 255 && data[1] === 216 && data[2] === 255) return "jpeg";
  if (data.toString("ascii", 0, 4) === "RIFF" && data.toString("ascii", 8, 12) === "WEBP") return "webp";
  throw new ApiError("PNG, JPG, WebP 이미지만 업로드할 수 있습니다.", 415, "file", "INVALID_MEDIA_TYPE");
}
export async function encodeManagedImage(bytes: Uint8Array) {
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_MEDIA_INPUT) throw new ApiError("이미지는 5MB 이하로 선택해 주세요.", 413, "file", "MEDIA_TOO_LARGE");
  const format = signature(bytes);
  try {
    const metadata = await sharp(bytes, { limitInputPixels: 25_000_000, animated: false, failOn: "warning" }).metadata();
    if (metadata.format !== format || (metadata.pages ?? 1) !== 1 || !metadata.width || !metadata.height || metadata.width * metadata.height > 25_000_000) throw new Error("Invalid image");
    const { data, info } = await sharp(bytes, { limitInputPixels: 25_000_000, failOn: "warning" }).rotate().resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true }).webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    if (data.byteLength > MAX_MEDIA_OUTPUT) throw new ApiError("이미지가 너무 복잡합니다. 크기를 줄여 다시 선택해 주세요.", 413, "file", "MEDIA_TOO_LARGE");
    return { data, width: info.width, height: info.height, etag: `"${createHash("sha256").update(data).digest("hex")}"` };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("이미지를 읽을 수 없습니다. 다른 PNG, JPG, WebP 파일을 선택해 주세요.", 415, "file", "INVALID_MEDIA_TYPE");
  }
}

export async function saveManagedImage(bytes: Uint8Array) {
  const bucket = managedMediaBucket();
  const encoded = await encodeManagedImage(bytes), id = randomUUID();
  await bucket.file(`managed-content/${id}.webp`).save(encoded.data, {
    resumable: false, preconditionOpts: { ifGenerationMatch: 0 },
    metadata: { contentType: "image/webp", cacheControl: MANAGED_MEDIA_CACHE_CONTROL, metadata: { sha256: encoded.etag.slice(1, -1) } },
  });
  return { url: `/api/content-media/${id}`, width: encoded.width, height: encoded.height };
}

export async function readManagedImage(id: string, ifNoneMatch: string | null = null) {
  if (!isManagedMediaId(id)) throw new ApiError("이미지를 찾을 수 없습니다.", 404);
  const bucket = managedMediaBucket(), key = `managed-content/${id}.webp`;
  const file = bucket.file(key);
  try {
    const [metadata] = await file.getMetadata();
    const size = Number(metadata.size);
    if (metadata.contentType !== "image/webp" || !Number.isSafeInteger(size) || size <= 0 || size > MAX_MEDIA_OUTPUT) throw new ApiError("이미지를 찾을 수 없습니다.", 404);
    const generation = typeof metadata.generation === "string" && /^[1-9][0-9]*$/.test(metadata.generation) ? metadata.generation : null;
    const versionSuffix = generation ? `-g${generation}` : "";
    // The body-issued validator binds the saved hash to a non-editable GCS object version.
    const sha256 = metadata.metadata?.sha256;
    if (generation && typeof sha256 === "string" && /^[a-f0-9]{64}$/.test(sha256) && ifNoneMatch === `"${sha256}${versionSuffix}"`) {
      return { data: null, etag: `"${sha256}${versionSuffix}"` };
    }
    const version = generation ? bucket.file(key, { generation }) : file;
    const [data] = await version.download({ validation: "crc32c" });
    if (data.byteLength !== size || data.byteLength > MAX_MEDIA_OUTPUT) throw new ApiError("이미지를 찾을 수 없습니다.", 404);
    return { data, etag: `"${createHash("sha256").update(data).digest("hex")}${versionSuffix}"` };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (typeof error === "object" && error !== null && "code" in error && (error.code === 404 || error.code === "404")) throw new ApiError("이미지를 찾을 수 없습니다.", 404);
    throw new ApiError("이미지를 불러오지 못했습니다.", 503);
  }
}
