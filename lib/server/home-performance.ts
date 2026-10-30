import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { unstable_rethrow } from "next/navigation";

interface Timing { step: string; ms: number; ok: boolean; cache?: "hit" | "miss" | "error" }
const timings = new AsyncLocalStorage<Timing[]>();
let loggedFirstHome = false;

export async function measureHomeTask<T>(step: string, task: () => Promise<T>, cacheMiss?: () => boolean): Promise<T> {
  const entries = timings.getStore();
  if (!entries) return task();
  const start = performance.now();
  let ok = false;
  try { const result = await task(); ok = true; return result; }
  finally { entries.push({ step, ms: Math.round(performance.now() - start), ok, ...(cacheMiss ? { cache: cacheMiss() ? "miss" as const : ok ? "hit" as const : "error" as const } : {}) }); }
}

export async function traceHomeData<T>(scope: "home" | "layout-banners" | "home-manifest", task: () => Promise<T>): Promise<T> {
  const entries: Timing[] = [];
  const start = performance.now();
  let ok = false;
  let frameworkSignal = false;
  try { const result = await timings.run(entries, task); ok = true; return result; }
  catch (error) {
    try { unstable_rethrow(error); }
    catch (signal) { frameworkSignal = true; throw signal; }
    throw error;
  }
  finally {
    const ms = Math.round(performance.now() - start);
    const firstHome = !frameworkSignal && ok && scope === "home" && !loggedFirstHome;
    if (firstHome) loggedFirstHome = true;
    if (!frameworkSignal && (firstHome || ms >= 1000 || !ok || entries.some(entry => !entry.ok || entry.cache === "miss"))) {
      console.info("[home-performance]", JSON.stringify({ id: randomUUID(), scope, region: process.env.VERCEL_REGION ?? "local", ms, ok, steps: entries }));
    }
  }
}
