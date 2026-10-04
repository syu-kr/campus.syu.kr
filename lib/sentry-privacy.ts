import type { Breadcrumb, Event } from "@sentry/nextjs";

export function scrubSentryEvent<T extends Event>(event: T): T {
  delete event.user;
  if (event.transaction) event.transaction = removeQuery(event.transaction);

  if (event.request) {
    if (event.request.url) event.request.url = removeQuery(event.request.url);
    delete event.request.cookies;
    delete event.request.data;
    delete event.request.headers;
    delete event.request.query_string;
  }

  event.breadcrumbs = event.breadcrumbs?.map(scrubSentryBreadcrumb);
  event.spans = event.spans?.map((span) => ({
    ...span,
    description: span.description ? removeQuery(span.description) : span.description,
    data: span.data ? Object.fromEntries(Object.entries(span.data).map(([key, value]) => [key,
      /url|target|location/i.test(key) && typeof value === "string" ? removeQuery(value) : value,
    ])) : span.data,
  }));
  return event;
}

export function isPrivateRoommateAuthEvent(event: Event) {
  const pathPattern = /\/(?:en\/)?campus\/roommates\/verify\/finish(?:[/?#]|$)/;
  return pathPattern.test(event.request?.url ?? "") || pathPattern.test(event.transaction ?? "") ||
    (typeof window !== "undefined" && pathPattern.test(window.location.pathname));
}

export function scrubSentryBreadcrumb(breadcrumb: Breadcrumb) {
  if (!breadcrumb.data) return breadcrumb;

  return {
    ...breadcrumb,
    data: Object.fromEntries(
      Object.entries(breadcrumb.data).map(([key, value]) => [
        key,
        ["url", "from", "to"].includes(key) && typeof value === "string"
          ? removeQuery(value)
          : value,
      ]),
    ),
  };
}

function removeQuery(value: string) {
  const queryIndex = value.indexOf("?");
  return queryIndex === -1 ? value : value.slice(0, queryIndex);
}
