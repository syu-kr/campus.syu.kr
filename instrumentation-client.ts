// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import {
  scrubSentryBreadcrumb,
  scrubSentryEvent,
  isPrivateRoommateAuthEvent,
} from "@/lib/sentry-privacy";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // The app uses error events and breadcrumbs, without structured logs or metrics.
  enableLogs: false,
  enableMetrics: false,

  dataCollection: {
    userInfo: false,
    httpBodies: [],
  },
  beforeSend: (event) => isPrivateRoommateAuthEvent(event) ? null : scrubSentryEvent(event),
  beforeSendTransaction: (event) => isPrivateRoommateAuthEvent(event) ? null : scrubSentryEvent(event),
  beforeBreadcrumb: scrubSentryBreadcrumb,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
