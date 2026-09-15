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
  return event;
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
