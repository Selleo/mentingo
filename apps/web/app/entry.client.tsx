/**
 * By default, Remix will handle hydrating your app on the client for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.client
 */
import {
  createRoutesFromChildren,
  matchRoutes,
  RemixBrowser,
  useLocation,
  useNavigationType,
} from "@remix-run/react";
import * as Sentry from "@sentry/react";
import { StrictMode, useEffect } from "react";
import { hydrateRoot } from "react-dom/client";

import { version } from "../version.json";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  integrations: [
    Sentry.reactRouterV6BrowserTracingIntegration({
      useEffect,
      useLocation,
      useNavigationType,
      createRoutesFromChildren,
      matchRoutes,
    }),
    // eslint-disable-next-line import/namespace
    Sentry.replayIntegration(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  environment: import.meta.env.MODE,
  beforeSend(event) {
    if (import.meta.env.DEV) {
      return null;
    }
    return event;
  },
});

// eslint-disable-next-line import/namespace
Sentry.setTags({
  version,
});

hydrateRoot(
  document,
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<div>An error occurred</div>}>
      <RemixBrowser />
    </Sentry.ErrorBoundary>
  </StrictMode>,
);
