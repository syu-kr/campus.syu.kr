import { mergeConfig } from "vitest/config";
import roommateConfig from "./vitest.roommates.integration.config";

export default mergeConfig(roommateConfig, {
  test: { include: ["tests/service-flows.integration.ts"] },
});
