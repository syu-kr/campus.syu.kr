// Permanent preview assignments: never derive numbers from ordering or recycle IDs.
export const previewFleet = Object.freeze({
  "preview-bus-a": 1,
  "preview-bus-b": 2,
  "preview-bus-c": 3,
  "preview-bus-d": 4,
  "preview-bus-e": 5,
  "preview-bus-f": 6,
  "preview-bus-g": 7,
  "preview-bus-h": 8,
  "preview-bus-i": 9,
  "preview-bus-j": 10,
} as const);

export type PreviewVehicleId = keyof typeof previewFleet;

export function isPreviewVehicleId(value: string | null): value is PreviewVehicleId {
  return value !== null && Object.hasOwn(previewFleet, value);
}

export function vehiclePinSvg(routeColor: string, muted = false): string {
  const color = muted ? "#6b7280" : routeColor;
  const ink = !muted && (routeColor === "#10b981" || routeColor === "#f59e0b") ? "#173247" : "white";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48"><path d="M20 1C9.5 1 1 9.5 1 20c0 13.5 19 27 19 27s19-13.5 19-27C39 9.5 30.5 1 20 1Z" fill="${color}" stroke="white" stroke-width="2"/><rect x="12" y="9" width="16" height="19" rx="4" fill="${ink}"/><rect x="14" y="12" width="12" height="7" rx="1" fill="${color}"/><circle cx="16" cy="24" r="1.5" fill="${color}"/><circle cx="24" cy="24" r="1.5" fill="${color}"/><path d="M14 27v4m12-4v4" stroke="${ink}" stroke-width="3" stroke-linecap="round"/></svg>`;
}
