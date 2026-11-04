import { defineConfig } from "vitest/config";
import roommateConfig from "./vitest.roommates.integration.config";

export default defineConfig({
  ...roommateConfig,
  test: { ...roommateConfig.test, include: ["tests/service-flows.integration.ts"] },
});
