type NextFetchOptions = {
  revalidate?: number | false;
  tags?: string[];
};

export type FetchJsonOptions<T> = Omit<RequestInit, "cache"> & {
  cache?: RequestCache;
  fallback: T;
  noStore?: boolean;
  next?: NextFetchOptions;
  timeoutMs?: number;
};

export async function fetchJson<T>(
  input: RequestInfo | URL,
  {
    fallback,
    noStore = true,
    next,
    timeoutMs,
    ...init
  }: FetchJsonOptions<T>,
): Promise<T> {
  const controller =
    timeoutMs && !init.signal ? new AbortController() : undefined;
  const timeoutId = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : undefined;

  try {
    const requestInit: RequestInit & { next?: NextFetchOptions } = {
      ...init,
      cache: noStore ? "no-store" : init.cache,
      next: noStore ? undefined : next,
      signal: init.signal ?? controller?.signal,
    };

    const response = await fetch(input, requestInit);

    if (!response.ok) {
      return fallback;
    }

    const data = await response.json();
    return (data ?? fallback) as T;
  } catch {
    return fallback;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
