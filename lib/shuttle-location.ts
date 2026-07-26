import type { BusLocation } from "@/types";

const VALID_SHUTTLE_STATUSES = new Set<BusLocation["status"]>([0, 1, 2]);
const VALID_SHUTTLE_ROUTES = new Set<BusLocation["routeid"]>([1, 2, 3, 4]);

export function toBusLocation(item: unknown): BusLocation | null {
  if (!item || typeof item !== "object") return null;

  const record = item as Record<string, unknown>;
  const id = String(record.id ?? record.name ?? "").trim();
  const name = String(record.name ?? id).trim();
  const latitude = Number(record.lat);
  const longitude = Number(record.lon);
  const status = Number(record.status);
  const routeid = Number(record.routeid);

  if (
    !/^[A-Za-z0-9가-힣_-]{1,128}$/.test(id) ||
    !name ||
    name.length > 128 ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    !Number.isInteger(status) ||
    !VALID_SHUTTLE_STATUSES.has(status as BusLocation["status"]) ||
    !Number.isInteger(routeid) ||
    !VALID_SHUTTLE_ROUTES.has(routeid as BusLocation["routeid"])
  ) {
    return null;
  }

  return {
    id,
    name,
    lat: String(latitude),
    lon: String(longitude),
    status: status as BusLocation["status"],
    routeid: routeid as BusLocation["routeid"],
  };
}
