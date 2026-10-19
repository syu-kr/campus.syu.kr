import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    exclude: [...configDefaults.exclude, ".cache/**", "output/**", ".playwright-mcp/**"],
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    restoreMocks: true,
  },
});
