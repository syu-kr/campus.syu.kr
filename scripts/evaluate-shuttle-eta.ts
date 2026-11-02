import { openSync, closeSync, fstatSync, readSync } from "node:fs";
import { evaluateShuttleForecasts } from "../lib/shuttle-eta-evaluation";

try {
  const file = process.argv[2];
  if (!file) throw new Error("Missing private forecast snapshot");
  const limit = 10 * 1024 * 1024;
  const descriptor = openSync(file, "r");
  let text: string;
  try {
    const stat = fstatSync(descriptor);
    if (!stat.isFile() || stat.size > limit) throw new Error("Snapshot too large");
    const bytes = Buffer.alloc(limit + 1);
    let length = 0;
    while (length <= limit) {
      const read = readSync(descriptor, bytes, length, bytes.length - length, null);
      if (!read) break;
      length += read;
    }
    if (length > limit) throw new Error("Snapshot too large");
    text = bytes.subarray(0, length).toString("utf8");
  } finally { closeSync(descriptor); }
  console.log(JSON.stringify(evaluateShuttleForecasts(JSON.parse(text)), null, 2));
} catch {
  console.error("ETA evaluation failed. Check the private forecast snapshot.");
  process.exitCode = 1;
}
