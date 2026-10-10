import { spawn } from "node:child_process";
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CRAWL_DATA_MAX_BYTES,
  parseCrawlSourceHealthMap,
  validateDailyCrawlData,
  type CrawlSourceHealth,
  type DailyCrawlDataFile,
} from "../lib/crawl-data-contract";

interface CrawlSource {
  fileName: DailyCrawlDataFile;
  script: string;
  command: "python" | "node";
}

interface CrawlResult {
  exitCode: number | null;
  incomplete?: boolean;
}

const SOURCES: CrawlSource[] = [
  { fileName: "announcements-academic.json", script: "crawl_announcements.py", command: "python" },
  { fileName: "announcements-scholarship.json", script: "crawl_scholarships.py", command: "python" },
  { fileName: "announcements-campus-life.json", script: "crawl_campus.py", command: "python" },
  { fileName: "announcements-events.json", script: "crawl_events.py", command: "python" },
  { fileName: "announcements-departments.json", script: "crawl_department_notices.py", command: "python" },
  { fileName: "announcements-sw.json", script: "crawl_swuniv_notices.py", command: "python" },
  { fileName: "cafeteria-menu.json", script: "crawl_cafeteria.py", command: "python" },
  { fileName: "public-holidays.json", script: "crawl_public_holidays.py", command: "python" },
];
const AI_SOURCE: CrawlSource = {
  fileName: "announcement-ai-metadata.json",
  script: "generate_announcement_ai_summaries.mjs",
  command: "node",
};

export function hasIncompleteCrawlOutput(output: string) {
  // Recoverable request attempts use [retry]; only exhausted or invalid sources emit [warn].
  // ponytail: known warnings are conservative; replace with structured crawler outcomes if formats change.
  return /\[warn\]|⚠|학과 홈페이지 매칭 결과가 없어|\[Announcement AI\] generation failed|OPENAI_API_KEY is not configured/.test(output);
}

export function runCrawler(source: CrawlSource): Promise<CrawlResult> {
  const timeoutMs = (source.fileName === "announcements-departments.json" ? 15 : 5) * 60 * 1000;
  const startedAt = Date.now();
  console.log(`[daily-crawl] ${source.fileName}: starting (limit=${timeoutMs / 1000}s)`);
  return new Promise((resolve) => {
    const script = path.join("scripts", source.script);
    const child = spawn(
      source.command === "python" ? "python" : process.execPath,
      source.command === "python" ? ["-u", script] : [script],
      {
        stdio: ["ignore", "pipe", "pipe"],
        timeout: timeoutMs,
      },
    );
    let incomplete = false;
    let tail = "";
    const observe = (output: string) => {
      const combined = tail + output;
      incomplete ||= hasIncompleteCrawlOutput(combined);
      tail = combined.slice(-160);
    };
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (output: string) => {
      observe(output);
      process.stdout.write(output);
    });
    child.stderr.on("data", (output: string) => {
      observe(output);
      process.stderr.write(output);
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      console.error(`[daily-crawl] ${source.fileName}: process error=${error.code || "unknown"} after ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
      resolve({ exitCode: null, incomplete });
    });
    child.on("close", (exitCode, signal) => {
      console.log(`[daily-crawl] ${source.fileName}: closed after ${((Date.now() - startedAt) / 1000).toFixed(1)}s (exit=${exitCode}, signal=${signal || "none"}, limit=${timeoutMs / 1000}s)`);
      resolve({ exitCode, incomplete });
    });
  });
}

function validatePayload(fileName: DailyCrawlDataFile, payload: Buffer) {
  if (payload.byteLength > CRAWL_DATA_MAX_BYTES[fileName]) {
    throw new Error(`${fileName} exceeds the allowed size`);
  }
  validateDailyCrawlData(fileName, JSON.parse(payload.toString("utf8")));
}

export async function runDailyCrawl(options: {
  dataDir?: string;
  healthPath?: string;
  mode?: "all" | "cafeteria" | "holidays" | "ai";
  aiEnabled?: boolean;
  holidaysEnabled?: boolean;
  run?: (source: CrawlSource) => Promise<CrawlResult>;
  now?: () => Date;
} = {}) {
  const dataDir = options.dataDir || path.join(process.cwd(), "public", "data");
  const healthPath = options.healthPath || path.join(process.cwd(), ".cache", "crawl-data-health.json");
  const holidaysEnabled = options.holidaysEnabled ?? process.env.PUBLIC_HOLIDAYS_ENABLED === "true";
  if (options.mode === "holidays" && !holidaysEnabled) {
    throw new Error("Public holiday crawling is disabled; deploy the compatible app and enable PUBLIC_HOLIDAYS_ENABLED first.");
  }
  const sources = options.mode === "ai"
    ? options.aiEnabled === false ? [] : [AI_SOURCE]
    : options.mode === "cafeteria"
      ? SOURCES.filter((source) => source.fileName === "cafeteria-menu.json")
      : options.mode === "holidays"
        ? SOURCES.filter((source) => source.fileName === "public-holidays.json")
        : SOURCES.filter((source) => source.fileName !== "public-holidays.json" || holidaysEnabled);
  const run = options.run || runCrawler;
  const now = options.now || (() => new Date());
  let health: Partial<Record<DailyCrawlDataFile, CrawlSourceHealth>> = {};
  try {
    const cached = JSON.parse(await readFile(healthPath, "utf8")) as { files?: unknown };
    health = parseCrawlSourceHealthMap(cached.files);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  // Verify every backup before any child can modify it. Invalid baselines must stop publication.
  const backups = new Map<DailyCrawlDataFile, Buffer>();
  for (const source of sources) {
    const original = await readFile(path.join(dataDir, source.fileName));
    validatePayload(source.fileName, original);
    backups.set(source.fileName, original);
  }

  for (const source of sources) {
    const previous = health[source.fileName];
    let errorCode: CrawlSourceHealth["errorCode"];
    try {
      const result = await run(source);
      if (result.exitCode !== 0) errorCode = "CRAWLER_FAILED";
      else if (result.incomplete) errorCode = "INCOMPLETE_SOURCE";
      else {
        try {
          validatePayload(source.fileName, await readFile(path.join(dataDir, source.fileName)));
        } catch {
          errorCode = "INVALID_DATA";
        }
      }
    } catch {
      errorCode = "CRAWLER_FAILED";
    }

    const lastAttemptAt = now().toISOString();
    if (errorCode) {
      await writeFile(path.join(dataDir, source.fileName), backups.get(source.fileName)!);
      health[source.fileName] = {
        status: "stale",
        lastAttemptAt,
        ...(previous?.lastSuccessAt ? { lastSuccessAt: previous.lastSuccessAt } : {}),
        errorCode,
      };
      console.warn(`::warning::${source.fileName}: ${errorCode}; preserved previous validated bytes; last success=${previous?.lastSuccessAt || "unknown"}`);
    } else {
      health[source.fileName] = { status: "fresh", lastAttemptAt, lastSuccessAt: lastAttemptAt };
    }
    console.log(`[daily-crawl] ${source.fileName}: ${health[source.fileName]!.status}${errorCode ? ` (${errorCode}; preserved previous bytes)` : ""}`);
  }

  await mkdir(path.dirname(healthPath), { recursive: true });
  const temporaryPath = `${healthPath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify({ files: health }, null, 2)}\n`);
  await rename(temporaryPath, healthPath);
  return health;
}

async function main() {
  const mode = process.argv.includes("--ai-only")
    ? "ai"
    : process.argv.includes("--holidays-only")
      ? "holidays"
      : process.env.CAFETERIA_ONLY_RUN === "true" ? "cafeteria" : "all";
  const aiEnabled = process.env.ANNOUNCEMENT_AI_ENABLED !== "false";
  const health = await runDailyCrawl({ mode, aiEnabled });
  const summaryPath = process.env.GITHUB_STEP_SUMMARY;
  if (summaryPath) {
    const lines = [
      `### Daily crawl (${mode})`,
      ...(mode === "ai" && !aiEnabled ? ["AI generation is disabled; existing source health and bytes are unchanged."] : []),
      "Failed or incomplete sources retain their previous validated bytes; successful sources may publish.",
      "",
      "| Source | Status | Last attempt | Last successful validation | Error |",
      "| --- | --- | --- | --- | --- |",
      ...Object.entries(health).map(([fileName, entry]) =>
        `| ${fileName} | ${entry.status} | ${entry.lastAttemptAt} | ${entry.lastSuccessAt || "unknown"} | ${entry.errorCode || ""} |`,
      ),
    ];
    await appendFile(summaryPath, `${lines.join("\n")}\n`);
  }
}

if (typeof require !== "undefined" && require.main === module) {
  main().catch(() => {
    console.error("[daily-crawl] crawling disabled or baseline, rollback, or health persistence failed; publication must stop. Check PUBLIC_HOLIDAYS_ENABLED for holidays-only runs.");
    process.exitCode = 1;
  });
}
