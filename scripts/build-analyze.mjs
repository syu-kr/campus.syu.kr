import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const nextBin = resolve("node_modules", "next", "dist", "bin", "next");
const result = spawnSync(process.execPath, [nextBin, "build", "--webpack"], {
  stdio: "inherit",
  env: {
    ...process.env,
    ANALYZE: "true",
  },
});

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
