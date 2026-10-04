import path from "node:path";
import { defineConfig } from "vitest/config";

// Never load .env.local or service-account credentials for integration tests.
const emulatorEnvironment = {
  FIREBASE_AUTH_EMULATOR_HOST: "127.0.0.1:9098",
  FIRESTORE_EMULATOR_HOST: "127.0.0.1:8188",
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-syu-roommates",
} as const;
for (const [name, expected] of Object.entries(emulatorEnvironment)) {
  // Knip reads this config without executing tests; Vitest sets VITEST before loading it.
  if (process.env.VITEST === "true" && process.env[name] && process.env[name] !== expected) {
    throw new Error(`Roommate integration tests require ${name}=${expected}`);
  }
}

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    environment: "node",
    include: ["tests/roommate.integration.ts"],
    env: { ...emulatorEnvironment, NEXT_PUBLIC_FIREBASE_API_KEY: "demo-api-key" },
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
