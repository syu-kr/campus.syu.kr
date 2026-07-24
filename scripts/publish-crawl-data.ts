import { createHash } from "node:crypto";
import {
  appendFile,
  mkdir,
  readFile,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
  CRAWL_DATA_RETAINED_VERSION_LIMIT,
  DAILY_CRAWL_DATA_FILES,
  type CrawlDataManifest,
  type DailyCrawlDataFile,
  parseCrawlDataManifest,
  validateCrawlDataVersion,
} from "../lib/crawl-data-contract";

const DATA_DIR = path.join(process.cwd(), "public", "data");
const DEFAULT_CRAWL_DATA_BASE_URL =
  "https://syu-kr.github.io/campus.syu.kr/crawl-data";
const FETCH_TIMEOUT_MS = 10_000;
const MAX_MANIFEST_BYTES = 64 * 1024;

interface CrawlDataSnapshot {
  manifest: CrawlDataManifest;
  payloads: Map<DailyCrawlDataFile, Buffer>;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--dry-run")) {
    const snapshot = await buildLocalSnapshot();
    console.log(
      `[crawl-data] dry-run validated ${snapshot.payloads.size} files`,
    );
    return;
  }

  if (args.includes("--pull-current")) {
    await pullCurrent();
    return;
  }

  const prepareIndex = args.indexOf("--prepare-pages");
  if (prepareIndex >= 0) {
    const outputDir = args[prepareIndex + 1];
    if (!outputDir) {
      throw new Error("--prepare-pages 다음에 출력 디렉터리가 필요합니다.");
    }
    await preparePagesArtifact(outputDir);
    return;
  }

  const rollbackIndex = args.indexOf("--rollback");
  if (rollbackIndex >= 0) {
    const version = args[rollbackIndex + 1];
    const outputDir = args[rollbackIndex + 2];
    if (!version || !outputDir) {
      throw new Error(
        "--rollback 다음에 버전과 출력 디렉터리를 지정해야 합니다.",
      );
    }
    await prepareRollbackArtifact(version, outputDir);
    return;
  }

  throw new Error(
    "실행 모드를 지정해야 합니다: --dry-run, --pull-current, --prepare-pages, --rollback",
  );
}

async function preparePagesArtifact(outputDir: string) {
  const localSnapshot = await buildLocalSnapshot();
  const remoteCurrent = await fetchManifest("current.json", true);

  if (remoteCurrent && manifestsHaveSameFiles(remoteCurrent, localSnapshot.manifest)) {
    console.log(
      `[crawl-data] no changes since version ${remoteCurrent.version}; Pages deploy skipped`,
    );
    await writeGitHubOutput("changed", "false");
    await writeGitHubOutput("version", remoteCurrent.version);
    return;
  }

  const previousVersions = remoteCurrent?.retainedVersions.slice(
    0,
    CRAWL_DATA_RETAINED_VERSION_LIMIT - 1,
  );
  const previousSnapshots = await downloadAvailableSnapshots(
    previousVersions ?? [],
  );
  const snapshots = [localSnapshot, ...previousSnapshots];
  const retainedVersions = snapshots.map(({ manifest }) => manifest.version);

  await writePagesArtifact(
    outputDir,
    snapshots,
    localSnapshot.manifest.version,
    retainedVersions,
  );
  await writeGitHubOutput("changed", "true");
  await writeGitHubOutput("version", localSnapshot.manifest.version);

  console.log(
    `[crawl-data] prepared Pages version ${localSnapshot.manifest.version} ` +
      `(retained ${retainedVersions.length})`,
  );
}

async function prepareRollbackArtifact(version: string, outputDir: string) {
  validateCrawlDataVersion(version);
  const current = await fetchManifest("current.json", false);
  if (!current) {
    throw new Error("게시된 current.json이 없어 롤백할 수 없습니다.");
  }
  if (!current.retainedVersions.includes(version)) {
    throw new Error(
      `${version}은 현재 Pages 아티팩트에 보존된 버전이 아닙니다.`,
    );
  }

  const orderedVersions = [
    version,
    ...current.retainedVersions.filter((item) => item !== version),
  ].slice(0, CRAWL_DATA_RETAINED_VERSION_LIMIT);
  const snapshots = await Promise.all(
    orderedVersions.map((item) => downloadSnapshot(item)),
  );

  await writePagesArtifact(outputDir, snapshots, version, orderedVersions);
  await writeGitHubOutput("changed", "true");
  await writeGitHubOutput("version", version);
  console.log(`[crawl-data] prepared rollback artifact for ${version}`);
}

async function pullCurrent() {
  const manifest = await fetchManifest("current.json", true);
  if (!manifest) {
    console.log(
      "[crawl-data] Pages current.json이 없어 번들 데이터를 최초 게시 기준으로 사용합니다.",
    );
    return;
  }

  const snapshot = await downloadSnapshot(manifest.version, manifest);
  await mkdir(DATA_DIR, { recursive: true });

  for (const fileName of DAILY_CRAWL_DATA_FILES) {
    const payload = snapshot.payloads.get(fileName);
    if (!payload) {
      throw new Error(`${fileName} 복원 payload가 없습니다.`);
    }
    await writeFile(path.join(DATA_DIR, fileName), payload);
    console.log(`[crawl-data] restored ${fileName}`);
  }

  console.log(`[crawl-data] restored current version ${manifest.version}`);
}

async function buildLocalSnapshot(): Promise<CrawlDataSnapshot> {
  const version = buildVersion();
  const files = {} as CrawlDataManifest["files"];
  const payloads = new Map<DailyCrawlDataFile, Buffer>();

  for (const fileName of DAILY_CRAWL_DATA_FILES) {
    const payload = await readValidatedJson(fileName);
    payloads.set(fileName, payload);
    files[fileName] = {
      path: `versions/${version}/${fileName}`,
      sha256: sha256(payload),
      size: payload.byteLength,
    };
  }

  const manifest = parseCrawlDataManifest({
    schemaVersion: 1,
    version,
    publishedAt: new Date().toISOString(),
    files,
    retainedVersions: [version],
  });

  return { manifest, payloads };
}

async function downloadAvailableSnapshots(
  versions: string[],
): Promise<CrawlDataSnapshot[]> {
  const snapshots: CrawlDataSnapshot[] = [];

  for (const version of versions) {
    try {
      snapshots.push(await downloadSnapshot(version));
    } catch (error) {
      console.warn(
        `[crawl-data] 이전 버전 ${version} 보존에 실패해 건너뜁니다.`,
        error,
      );
    }
  }

  return snapshots;
}

async function downloadSnapshot(
  version: string,
  knownManifest?: CrawlDataManifest,
): Promise<CrawlDataSnapshot> {
  validateCrawlDataVersion(version);
  const manifest =
    knownManifest ??
    (await fetchManifest(`versions/${version}/manifest.json`, false));
  if (!manifest || manifest.version !== version) {
    throw new Error(`${version} manifest를 찾지 못했거나 버전이 다릅니다.`);
  }

  const payloads = new Map<DailyCrawlDataFile, Buffer>();
  for (const fileName of DAILY_CRAWL_DATA_FILES) {
    const entry = manifest.files[fileName];
    const payload = await fetchBuffer(entry.path);
    verifyPayload(fileName, payload, entry.sha256, entry.size);
    payloads.set(fileName, payload);
  }

  return { manifest, payloads };
}

async function writePagesArtifact(
  outputDir: string,
  snapshots: CrawlDataSnapshot[],
  currentVersion: string,
  retainedVersions: string[],
) {
  await assertOutputDoesNotExist(outputDir);

  const currentSnapshot = snapshots.find(
    ({ manifest }) => manifest.version === currentVersion,
  );
  if (!currentSnapshot) {
    throw new Error(`현재 버전 ${currentVersion}의 스냅샷이 없습니다.`);
  }

  const root = path.resolve(outputDir);
  const crawlDataRoot = path.join(root, "crawl-data");
  await mkdir(crawlDataRoot, { recursive: true });
  await writeFile(path.join(root, ".nojekyll"), "");
  await writeFile(
    path.join(root, "index.html"),
    "<!doctype html><meta charset=\"utf-8\"><title>SYU Campus crawl data</title>\n",
  );

  for (const snapshot of snapshots) {
    const versionDir = path.join(
      crawlDataRoot,
      "versions",
      snapshot.manifest.version,
    );
    await mkdir(versionDir, { recursive: true });

    for (const fileName of DAILY_CRAWL_DATA_FILES) {
      const payload = snapshot.payloads.get(fileName);
      if (!payload) {
        throw new Error(`${snapshot.manifest.version}/${fileName}이 없습니다.`);
      }
      await writeFile(path.join(versionDir, fileName), payload);
    }

    await writeFile(
      path.join(versionDir, "manifest.json"),
      serializeManifest(snapshot.manifest),
    );
  }

  const currentManifest = parseCrawlDataManifest({
    ...currentSnapshot.manifest,
    retainedVersions,
  });
  await writeFile(
    path.join(crawlDataRoot, "current.json"),
    serializeManifest(currentManifest),
  );
}

async function fetchManifest(
  relativePath: string,
  allowNotFound: boolean,
): Promise<CrawlDataManifest | undefined> {
  const response = await fetchRemote(relativePath);
  if (response.status === 404 && allowNotFound) return undefined;
  if (!response.ok) {
    throw new Error(`${relativePath} 응답 오류: ${response.status}`);
  }

  const payload = Buffer.from(await response.arrayBuffer());
  if (payload.byteLength > MAX_MANIFEST_BYTES) {
    throw new Error(`${relativePath}가 허용 크기를 초과했습니다.`);
  }

  return parseCrawlDataManifest(
    JSON.parse(payload.toString("utf8")) as unknown,
  );
}

async function fetchBuffer(relativePath: string): Promise<Buffer> {
  const response = await fetchRemote(relativePath);
  if (!response.ok) {
    throw new Error(`${relativePath} 응답 오류: ${response.status}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

function fetchRemote(relativePath: string): Promise<Response> {
  const baseUrl = getCrawlDataBaseUrl();
  const url = new URL(relativePath, `${baseUrl}/`);
  return fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
}

function getCrawlDataBaseUrl(): string {
  const configured =
    process.env.CRAWL_DATA_BASE_URL ?? DEFAULT_CRAWL_DATA_BASE_URL;
  const url = new URL(configured);
  if (url.protocol !== "https:") {
    throw new Error("CRAWL_DATA_BASE_URL은 HTTPS여야 합니다.");
  }
  return url.toString().replace(/\/+$/, "");
}

async function readValidatedJson(
  fileName: DailyCrawlDataFile,
): Promise<Buffer> {
  const payload = await readFile(path.join(DATA_DIR, fileName));
  try {
    JSON.parse(payload.toString("utf8"));
  } catch (error) {
    throw new Error(`${fileName}이 올바른 JSON이 아닙니다.`, { cause: error });
  }
  return payload;
}

function verifyPayload(
  fileName: DailyCrawlDataFile,
  payload: Buffer,
  expectedSha256: string,
  expectedSize: number,
) {
  if (payload.byteLength !== expectedSize) {
    throw new Error(`${fileName}의 크기가 manifest와 일치하지 않습니다.`);
  }
  if (sha256(payload) !== expectedSha256) {
    throw new Error(`${fileName}의 SHA-256 값이 manifest와 일치하지 않습니다.`);
  }
  try {
    JSON.parse(payload.toString("utf8"));
  } catch (error) {
    throw new Error(`${fileName}이 올바른 JSON이 아닙니다.`, { cause: error });
  }
}

function manifestsHaveSameFiles(
  current: CrawlDataManifest,
  next: CrawlDataManifest,
): boolean {
  return DAILY_CRAWL_DATA_FILES.every((fileName) => {
    const currentFile = current.files[fileName];
    const nextFile = next.files[fileName];
    return (
      currentFile.sha256 === nextFile.sha256 &&
      currentFile.size === nextFile.size
    );
  });
}

async function assertOutputDoesNotExist(outputDir: string) {
  try {
    await stat(outputDir);
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return;
    }
    throw error;
  }
  throw new Error(`출력 디렉터리가 이미 존재합니다: ${outputDir}`);
}

async function writeGitHubOutput(name: string, value: string) {
  const outputPath = process.env.GITHUB_OUTPUT;
  if (outputPath) {
    await appendFile(outputPath, `${name}=${value}\n`, "utf8");
  }
}

function buildVersion(): string {
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  const runId = process.env.GITHUB_RUN_ID?.replace(/[^A-Za-z0-9._-]/g, "");
  const runAttempt = process.env.GITHUB_RUN_ATTEMPT?.replace(
    /[^A-Za-z0-9._-]/g,
    "",
  );
  const suffix = runId ? `${runId}.${runAttempt || "1"}` : "local";
  return `${timestamp}-${suffix}`;
}

function serializeManifest(manifest: CrawlDataManifest): Buffer {
  return Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function sha256(payload: Buffer): string {
  return createHash("sha256").update(payload).digest("hex");
}

main().catch((error) => {
  console.error("[crawl-data] command failed:", error);
  process.exitCode = 1;
});
