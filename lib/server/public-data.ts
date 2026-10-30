import { readFile } from "node:fs/promises";
import path from "node:path";
import { unstable_rethrow } from "next/navigation";
import { publicDataMaxBytes, validatePublicData, type PublicDataFile } from "../public-data-snapshot";
import { parseStudentRestaurantMenu, parseStudentRestaurantPublicUrl } from "../student-restaurant";
import { readResponseBytes } from "./read-response-bytes";
import { getActivePublicData, publicDataFirebaseEnabled, readFirebasePublicData } from "./public-data-storage";

async function readBundledPublicData<T>(file: PublicDataFile): Promise<T> {
  const directory = file === "student-restaurant-1.json" ? "cafeteria" : "data";
  let content: string | undefined;
  try { content = await readFile(path.join(process.cwd(), "public", directory, file), "utf8"); }
  catch (error) {
    if (file !== "student-restaurant-1.json" || !(typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")) throw error;
    if (publicDataFirebaseEnabled()) {
      // shortcut: This release snapshot is not weekly synced; refresh it when newer recovery data is required.
      try { content = await readFile(path.join(process.cwd(), "data-source", "fallbacks", file), "utf8"); }
      catch (fallbackError) {
        if (!(typeof fallbackError === "object" && fallbackError !== null && "code" in fallbackError && fallbackError.code === "ENOENT")) throw fallbackError;
      }
    }
    if (content === undefined) {
      const url = parseStudentRestaurantPublicUrl(process.env.NEXT_PUBLIC_CAFETERIA_JSON_URL ?? "");
      if (publicDataFirebaseEnabled() && url.hostname === "campus.syu.kr") throw new Error("The public cafeteria fallback must not point to this API");
      const response = await fetch(url, { cache: "no-store", credentials: "omit", redirect: "error", referrerPolicy: "no-referrer", signal: AbortSignal.timeout(12_000) });
      if (!response.ok) throw new Error("Public cafeteria menu is unavailable");
      return parseStudentRestaurantMenu(JSON.parse(new TextDecoder().decode(await readResponseBytes(response, publicDataMaxBytes(file), "Public cafeteria menu")))) as T;
    }
  }
  if (Buffer.byteLength(content, "utf8") > publicDataMaxBytes(file)) throw new Error("Bundled public data exceeds size limit");
  const data: unknown = JSON.parse(content); validatePublicData(file, data); return data as T;
}
/** A single active manifest is pinned for related datasets; failures fall back as one bundle. */
export async function readPublicDataBundle<const Files extends readonly PublicDataFile[]>(files: Files): Promise<{ data: Record<Files[number], unknown>; source: "firebase-storage" | "bundled-fallback"; version: string }> {
  if (publicDataFirebaseEnabled()) {
    try {
      const active = await getActivePublicData();
      const pairs = await Promise.all(files.map(async file => [file, (await readFirebasePublicData(file, active)).data] as const));
      return { data: Object.fromEntries(pairs) as Record<Files[number], unknown>, source: "firebase-storage", version: active.manifest.version };
    } catch (error) { unstable_rethrow(error); }
  }
  const pairs = await Promise.all(files.map(async file => [file, await readBundledPublicData(file)] as const));
  return { data: Object.fromEntries(pairs) as Record<Files[number], unknown>, source: "bundled-fallback", version: "bundled" };
}
export async function readPublicDataJson<T>(file: PublicDataFile): Promise<T> {
  return (await readPublicDataBundle([file])).data[file] as T;
}
