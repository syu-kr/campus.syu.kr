type NextFetchOptions = {
  revalidate?: number | false;
  tags?: string[];
};

export type FetchJsonOptions<T> = Omit<RequestInit, "cache"> & {
  cache?: RequestCache;
  fallback: T;
  noStore?: boolean;
  next?: NextFetchOptions;
  throwOnError?: boolean;
  timeoutMs?: number;
};

export async function fetchJson<T>(
  input: RequestInfo | URL,
  {
    fallback,
    noStore = true,
    next,
    throwOnError = false,
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
      if (throwOnError) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      return fallback;
    }

    const data = await response.json();
    return (data ?? fallback) as T;
  } catch (error) {
    if (throwOnError) {
      throw error;
    }
    return fallback;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}
