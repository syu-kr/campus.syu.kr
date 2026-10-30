import { createHash } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";
import { initializeFirebaseAdmin } from "../firebaseAdmin";
import { measureHomeTask } from "./home-performance";
import { parsePublicDataManifest, publicDataMaxBytes, publicDataPath, validatePublicData, type PublicDataFile, type PublicDataManifest } from "../public-data-snapshot";

export interface ActivePublicData { manifest: PublicDataManifest; revision: number }
export interface PublicDataStore {
  readActive(): Promise<ActivePublicData | null>;
  readObject(key: string, maxBytes: number): Promise<Buffer>;
  createObject(key: string, bytes: Buffer): Promise<void>;
  compareAndSet(expectedRevision: number | null, manifest: PublicDataManifest): Promise<void>;
}
const digest = (payload: Buffer) => createHash("sha256").update(payload).digest("hex");
function isConflict(error: unknown) { return typeof error === "object" && error !== null && "code" in error && [409, 412, "409", "412"].includes(error.code as number | string); }
export function publicDataFirebaseEnabled() { return process.env.PUBLIC_DATA_BACKEND === "firebase"; }
function publicDataBucketName() {
  const name = process.env.PUBLIC_DATA_STORAGE_BUCKET || process.env.MANAGED_CONTENT_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "";
  if (!name || /[\s/\\]/.test(name)) throw new Error("Public data bucket is not configured");
  return name;
}
function deadline<T>(promise: Promise<T>, ms = 10_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("Public data request timed out")), ms); })]).finally(() => clearTimeout(timer));
}
export function firebasePublicDataStore(): PublicDataStore {
  initializeFirebaseAdmin();
  const bucket = getStorage().bucket(publicDataBucketName());
  const ref = getFirestore().collection("site_public_data").doc("current");
  return {
    async readActive() {
      const document = await deadline(ref.get());
      if (!document.exists) return null;
      const data = document.data()!;
      if (!Number.isSafeInteger(data.revision) || data.revision < 1) throw new Error("Invalid active public data revision");
      return { manifest: parsePublicDataManifest(data.manifest), revision: data.revision };
    },
    async readObject(key, maxBytes) {
      if (!/^public-data\/versions\/[A-Za-z0-9][A-Za-z0-9._-]{0,127}\/[A-Za-z0-9._-]+\.json$/.test(key)) throw new Error("Invalid public data object path");
      const [metadata] = await deadline(bucket.file(key).getMetadata());
      const size = Number(metadata.size);
      if (!Number.isSafeInteger(size) || size < 1 || size > maxBytes) throw new Error("Invalid public data object size");
      const stream = bucket.file(key, { generation: metadata.generation }).createReadStream({ validation: "crc32c" });
      const timer = setTimeout(() => stream.destroy(new Error("Public data download timed out")), 10_000);
      const chunks: Buffer[] = []; let bytes = 0;
      try {
        for await (const chunk of stream) { const part = Buffer.from(chunk); bytes += part.length; if (bytes > maxBytes) throw new Error("Public data object exceeds size limit"); chunks.push(part); }
        if (bytes !== size) throw new Error("Public data object size changed");
        return Buffer.concat(chunks);
      } finally { clearTimeout(timer); stream.destroy(); }
    },
    async createObject(key, bytes) {
      await deadline(bucket.file(key).save(bytes, { resumable: false, preconditionOpts: { ifGenerationMatch: 0 }, metadata: { contentType: "application/json; charset=utf-8", cacheControl: "public,max-age=31536000,immutable", metadata: { sha256: digest(bytes) } } }));
    },
    async compareAndSet(expectedRevision, manifest) {
      await deadline(getFirestore().runTransaction(async transaction => {
        const current = await transaction.get(ref);
        const revision = current.exists ? current.data()?.revision : null;
        if (revision !== expectedRevision) throw new Error("Public data active version changed; repeat the dry run");
        transaction.set(ref, { manifest, revision: (expectedRevision ?? 0) + 1 });
      }));
    },
  };
}

export async function readPublicSnapshotFile<T>(store: PublicDataStore, manifest: PublicDataManifest, file: PublicDataFile): Promise<T> {
  const entry = manifest.files[file];
  if (!entry) throw new Error(`Public data snapshot is missing ${file}`);
  const bytes = await store.readObject(entry.path, publicDataMaxBytes(file));
  if (bytes.length !== entry.size || digest(bytes) !== entry.sha256) throw new Error(`Public data integrity check failed: ${file}`);
  const value: unknown = JSON.parse(bytes.toString("utf8"));
  validatePublicData(file, value);
  return value as T;
}
async function createImmutable(store: PublicDataStore, key: string, bytes: Buffer) {
  try { await store.createObject(key, bytes); }
  catch (error) {
    if (!isConflict(error)) throw error;
    const existing = await store.readObject(key, bytes.length);
    if (digest(existing) !== digest(bytes)) throw new Error("An immutable public data version already has different contents");
  }
}
export async function uploadPublicSnapshot(store: PublicDataStore, manifest: PublicDataManifest, payloads: Map<PublicDataFile, Buffer>) {
  parsePublicDataManifest(manifest);
  for (const [file, entry] of Object.entries(manifest.files) as [PublicDataFile, NonNullable<PublicDataManifest["files"][PublicDataFile]>][]) {
    const bytes = payloads.get(file);
    if (!bytes || bytes.length !== entry.size || digest(bytes) !== entry.sha256) throw new Error(`Local public data integrity check failed: ${file}`);
    validatePublicData(file, JSON.parse(bytes.toString("utf8")));
  }
  for (const [file, bytes] of payloads) await createImmutable(store, publicDataPath(manifest.version, file), bytes);
  await createImmutable(store, publicDataPath(manifest.version, "manifest.json"), Buffer.from(JSON.stringify(manifest)));
}
export async function activatePublicSnapshot(store: PublicDataStore, manifest: PublicDataManifest, expected: ActivePublicData | null) {
  parsePublicDataManifest(manifest);
  for (const file of Object.keys(manifest.files) as PublicDataFile[]) await readPublicSnapshotFile(store, manifest, file);
  await store.compareAndSet(expected?.revision ?? null, manifest);
  activeCache = undefined;
}
export async function readStoredPublicManifest(store: PublicDataStore, version: string) {
  const bytes = await store.readObject(publicDataPath(version, "manifest.json"), 64 * 1024);
  const manifest = parsePublicDataManifest(JSON.parse(bytes.toString("utf8")));
  if (manifest.version !== version) throw new Error("Stored public data manifest has a different version");
  return manifest;
}

let activeCache: { bucket: string; expiresAt: number; promise: Promise<ActivePublicData> } | undefined;
const dataCache = new Map<string, Promise<unknown>>();
export async function getActivePublicData() {
  const bucket = publicDataBucketName(), now = Date.now();
  if (!activeCache || activeCache.bucket !== bucket || activeCache.expiresAt <= now) {
    const promise = measureHomeTask("manifest", () => firebasePublicDataStore().readActive()).then(value => { if (!value) throw new Error("Public data has no active Firebase snapshot"); return value; });
    activeCache = { bucket, expiresAt: now + 30_000, promise };
    void promise.catch(() => { if (activeCache?.promise === promise) activeCache = undefined; });
  }
  return activeCache.promise;
}
export async function readFirebasePublicData<T>(file: PublicDataFile, active?: ActivePublicData): Promise<{ data: T; manifest: PublicDataManifest }> {
  const current = active ?? await getActivePublicData();
  const key = `${publicDataBucketName()}/${current.manifest.version}/${file}/${current.manifest.files[file]?.sha256}`;
  let promise = dataCache.get(key);
  if (!promise) {
    promise = measureHomeTask(`snapshot:${file}`, () => readPublicSnapshotFile(firebasePublicDataStore(), current.manifest, file));
    dataCache.set(key, promise);
    if (dataCache.size > 46) dataCache.delete(dataCache.keys().next().value!);
    void promise.catch(() => { if (dataCache.get(key) === promise) dataCache.delete(key); });
  }
  return { data: await promise as T, manifest: current.manifest };
}
