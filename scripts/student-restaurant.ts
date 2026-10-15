import { createHash } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseStudentRestaurantMenu, type StudentRestaurantMenu } from "../lib/student-restaurant";

const MAX_API_BYTES = 1024 * 1024;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_PATH = /^\/uploadimages\/sikdan\/[a-z0-9_-]+\.(png|jpe?g|webp)$/i;
const ANALYSIS_VERSION = 4;

export interface StudentRestaurantImage {
  bytes: Buffer;
  contentType: string;
  lastModified: string | null;
}

export function parseStudentRestaurantApiUrl(value: string): URL {
  try {
    const url = new URL(value);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.hash) throw new Error();
    return url;
  } catch { throw new Error("INVALID_HAKSIK_API_URL"); }
}

export function studentRestaurantImageUrl(value: unknown, apiUrl: URL): URL {
  try {
    if (!value || typeof value !== "object" || !Array.isArray((value as Record<string, unknown>).shopEntities)) throw new Error();
    const shops = (value as { shopEntities: unknown[] }).shopEntities;
    const matches = shops.filter((shop): shop is Record<string, unknown> => Boolean(shop && typeof shop === "object" && (shop as Record<string, unknown>).shopId === 165));
    if (matches.length !== 1) throw new Error();
    const shop = matches[0];
    if (!shop.menuLinkType || typeof shop.menuLinkType !== "object" || (shop.menuLinkType as Record<string, unknown>).code !== "IMAGE" ||
      typeof shop.uploadFileName !== "string" || !IMAGE_PATH.test(shop.uploadFileName)) throw new Error();
    const imageUrl = new URL(shop.uploadFileName, apiUrl.origin);
    if (imageUrl.origin !== apiUrl.origin || !IMAGE_PATH.test(imageUrl.pathname) || imageUrl.search || imageUrl.hash) throw new Error();
    return imageUrl;
  } catch { throw new Error("INVALID_STUDENT_RESTAURANT_SOURCE"); }
}

async function boundedDownload(url: URL, maxBytes: number, allowedTypes: string[], request: typeof fetch) {
  try {
    const response = await request(url, { redirect: "error", signal: AbortSignal.timeout(20_000), cache: "no-store", headers: { Accept: allowedTypes.join(", ") } });
    const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? "";
    if (!response.ok || !allowedTypes.includes(contentType) || !response.body || Number(response.headers.get("content-length")) > maxBytes) throw new Error();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) throw new Error();
        chunks.push(value);
      }
    } finally { await reader.cancel(); }
    if (size === 0) throw new Error();
    const modifiedHeader = response.headers.get("last-modified");
    const modifiedTime = Date.parse(modifiedHeader ?? "");
    const lastModified = Number.isFinite(modifiedTime) && new Date(modifiedTime).toUTCString() === modifiedHeader ? new Date(modifiedTime).toISOString() : null;
    return { bytes: Buffer.concat(chunks), contentType, lastModified };
  } catch { throw new Error("STUDENT_RESTAURANT_DOWNLOAD_FAILED"); }
}

export async function downloadStudentRestaurantImage(apiUrl: URL, request: typeof fetch = fetch): Promise<StudentRestaurantImage> {
  const api = await boundedDownload(apiUrl, MAX_API_BYTES, ["application/json"], request);
  let value: unknown;
  try { value = JSON.parse(api.bytes.toString("utf8")); } catch { throw new Error("INVALID_STUDENT_RESTAURANT_SOURCE"); }
  const image = await boundedDownload(studentRestaurantImageUrl(value, apiUrl), MAX_IMAGE_BYTES, ["image/png", "image/jpeg", "image/webp"], request);
  const { bytes, contentType } = image;
  const valid = contentType === "image/png" ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) :
    contentType === "image/jpeg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255 :
      bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!valid) throw new Error("INVALID_STUDENT_RESTAURANT_IMAGE");
  return image;
}

export function studentRestaurantHash(bytes: Buffer | string): string {
  return createHash("sha256").update(bytes).digest("hex");
}

async function optionalRead(file: string): Promise<string | undefined> {
  try { return await readFile(file, "utf8"); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new Error("STUDENT_RESTAURANT_READ_FAILED");
  }
}

export async function collectStudentRestaurant(options: {
  apiUrl: URL;
  outputPath: string;
  statePath: string;
  analyze: (image: StudentRestaurantImage) => Promise<StudentRestaurantMenu>;
  analysisContext?: string;
  request?: typeof fetch;
}): Promise<"updated" | "unchanged"> {
  const image = await downloadStudentRestaurantImage(options.apiUrl, options.request);
  const imageHash = studentRestaurantHash(image.bytes);
  const analysisContextHash = studentRestaurantHash(JSON.stringify([image.lastModified, options.analysisContext ?? ""]));
  const previous = await optionalRead(options.outputPath);
  const state = await optionalRead(options.statePath);
  if (previous && state) {
    try {
      parseStudentRestaurantMenu(JSON.parse(previous));
      const checkpoint = JSON.parse(state) as Record<string, unknown>;
      if (checkpoint.analysisVersion === ANALYSIS_VERSION && checkpoint.imageHash === imageHash && checkpoint.analysisContextHash === analysisContextHash && checkpoint.outputHash === studentRestaurantHash(previous)) return "unchanged";
    } catch { /* A missing or invalid checkpoint must never suppress analysis. */ }
  }
  const menu = parseStudentRestaurantMenu(await options.analyze(image));
  if (!menu.days.length || menu.days.every((day) => [day.breakfast, day.lunch, day.dinner].every((meal) => meal === null))) throw new Error("STUDENT_RESTAURANT_EMPTY_ANALYSIS");
  const output = `${JSON.stringify(menu, null, 2)}\n`;
  const nextState = JSON.stringify({ analysisVersion: ANALYSIS_VERSION, imageHash, analysisContextHash, outputHash: studentRestaurantHash(output) });
  const outputTemp = `${options.outputPath}.tmp`;
  const stateTemp = `${options.statePath}.tmp`;
  await mkdir(path.dirname(options.outputPath), { recursive: true });
  await mkdir(path.dirname(options.statePath), { recursive: true });
  try {
    await writeFile(outputTemp, output, { mode: 0o600 });
    await writeFile(stateTemp, nextState, { mode: 0o600 });
    await rename(outputTemp, options.outputPath);
    await rename(stateTemp, options.statePath);
  } catch {
    // The workflow publishes and caches only after the entire collection succeeds.
    throw new Error("STUDENT_RESTAURANT_WRITE_FAILED");
  } finally {
    await Promise.all([rm(outputTemp, { force: true }), rm(stateTemp, { force: true })]);
  }
  return "updated";
}
