import crypto from "node:crypto";

import {
  SUBSCRIPTION_LIFETIME_DAYS,
  SYNC_HISTORY_DAYS,
  SYNC_HORIZON_MONTHS,
  WINDOW_REBUILD_AFTER_DAYS,
} from "../calendar.constants";

import type { CalendarConnection } from "../types/calendar-connection.types";

const DAY_MS = 86_400_000;

export const buildCalendarSyncWindow = () => {
  const now = new Date();
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - SYNC_HISTORY_DAYS);
  const end = new Date(now);
  end.setUTCMonth(end.getUTCMonth() + SYNC_HORIZON_MONTHS);
  return { start: start.toISOString(), end: end.toISOString() };
};

export const isCalendarSyncWindowOutdated = (
  connection: Pick<CalendarConnection, "syncCursor" | "windowBuiltAt">,
) => {
  if (!connection.syncCursor || !connection.windowBuiltAt) return true;
  return Date.now() - Date.parse(connection.windowBuiltAt) >= WINDOW_REBUILD_AFTER_DAYS * DAY_MS;
};

export const getCalendarSubscriptionExpiration = () => {
  const expiration = new Date();
  expiration.setUTCDate(expiration.getUTCDate() + SUBSCRIPTION_LIFETIME_DAYS);
  return expiration.toISOString();
};

export const isEventOutsideSyncWindow = (
  event: { startsAt: string; endsAt: string },
  window: { start: string | null; end: string | null },
) => {
  if (!window.start || !window.end) return false;
  return (
    Date.parse(event.endsAt) <= Date.parse(window.start) ||
    Date.parse(event.startsAt) >= Date.parse(window.end)
  );
};

export const isTimingSafeEqual = (provided: string, expected: string | null) => {
  if (!expected) return false;

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  return (
    providedBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  );
};
