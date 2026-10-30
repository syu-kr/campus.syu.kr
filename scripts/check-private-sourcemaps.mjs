import { readdirSync } from "node:fs";
import path from "node:path";

// A failed cleanup must not publish original client sources from an authenticated build.
const publicMaps = readdirSync(path.join(process.cwd(), ".next", "static"), { recursive: true })
  .filter(file => file.endsWith(".map"));
if (publicMaps.length) throw new Error(`Refusing to publish ${publicMaps.length} public source map(s).`);
console.log("Private source map check passed.");
