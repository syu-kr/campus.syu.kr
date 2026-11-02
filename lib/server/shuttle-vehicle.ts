import { createHmac } from "node:crypto";
import { etaServiceDate } from "../shuttle-eta";
import { requireServerEnv } from "./env";

export function shuttleVehicleKey(id: string, at: number) {
  return createHmac("sha256", requireServerEnv("RATE_LIMIT_SECRET"))
    .update(`shuttle-pilot:${etaServiceDate(at)}:${id}`).digest("hex").slice(0, 24);
}
