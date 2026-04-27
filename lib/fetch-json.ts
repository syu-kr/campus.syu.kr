type NextFetchOptions = {
  revalidate?: number | false;
  tags?: string[];
};

export type FetchJsonOptions<T> = Omit<RequestInit, "cache"> & {
  cache?: RequestCache;
  fallback: T;
  noStore?: boolean;
  next?: NextFetchOptions;
};

export async function fetchJson<T>(
  input: RequestInfo | URL,
  {
    fallback,
    noStore = true,
    next,
    ...init
  }: FetchJsonOptions<T>,
): Promise<T> {
  try {
    const requestInit: RequestInit & { next?: NextFetchOptions } = {
      ...init,
      cache: noStore ? "no-store" : init.cache,
      next: noStore ? { revalidate: 0, ...next } : next,
    };

    const response = await fetch(input, requestInit);

    if (!response.ok) {
      return fallback;
    }

    const data = await response.json();
    return (data ?? fallback) as T;
  } catch {
    return fallback;
  }
}
