export function resolveTransitTimestamp(
  usedRouteFallback: boolean,
  cachedTimestamp: string | undefined,
  currentTimestamp: string,
) {
  return usedRouteFallback && cachedTimestamp
    ? cachedTimestamp
    : currentTimestamp;
}
