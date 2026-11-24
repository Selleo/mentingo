import type {
  GOOGLE_CALENDAR_EVENT_STATUSES,
  GOOGLE_CALENDAR_EVENT_TRANSPARENCIES,
  GOOGLE_CALENDAR_EVENT_VISIBILITIES,
  GOOGLE_CALENDAR_MANAGED_EVENT_PROPERTY,
  GOOGLE_CALENDAR_OAUTH_PURPOSE,
} from "../calendar.constants";
import type { UUIDType } from "src/common";

export const GOOGLE_CALENDAR_SYNC_REASONS = {
  INITIAL: "initial",
  AUTHORIZATION: "authorization",
  MANUAL: "manual",
  WEBHOOK: "webhook",
  RECONCILIATION: "reconciliation",
} as const;

export type GoogleCalendarSyncReason =
  (typeof GOOGLE_CALENDAR_SYNC_REASONS)[keyof typeof GOOGLE_CALENDAR_SYNC_REASONS];

export const GOOGLE_CALENDAR_JOB_KINDS = {
  INBOUND: "inbound",
  OUTBOUND: "outbound",
} as const;

export type GoogleCalendarSyncJobData = {
  kind: typeof GOOGLE_CALENDAR_JOB_KINDS.INBOUND;
  tenantId: UUIDType;
  connectionId: UUIDType;
  fullSync: boolean;
  reason: GoogleCalendarSyncReason;
};

export type GoogleCalendarOutboundJobData = {
  kind: typeof GOOGLE_CALENDAR_JOB_KINDS.OUTBOUND;
  tenantId: UUIDType;
  connectionId: UUIDType;
  reason: GoogleCalendarSyncReason;
};

export type GoogleCalendarJobData = GoogleCalendarSyncJobData | GoogleCalendarOutboundJobData;

export type GoogleCalendarOAuthState = {
  tenantId: UUIDType;
  userId: UUIDType;
  purpose: typeof GOOGLE_CALENDAR_OAUTH_PURPOSE;
  nonce: string;
  replace: boolean;
  outboundSync?: boolean;
  origin: string;
  iat: number;
  exp: number;
};

export type GoogleTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
};

export type GoogleUserProfile = {
  sub: string;
  email: string;
};

export type GoogleCalendarEventDateTime = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

export type GoogleCalendarEventStatus =
  (typeof GOOGLE_CALENDAR_EVENT_STATUSES)[keyof typeof GOOGLE_CALENDAR_EVENT_STATUSES];

export type GoogleCalendarEventVisibility =
  (typeof GOOGLE_CALENDAR_EVENT_VISIBILITIES)[keyof typeof GOOGLE_CALENDAR_EVENT_VISIBILITIES];

export type GoogleCalendarEventTransparency =
  (typeof GOOGLE_CALENDAR_EVENT_TRANSPARENCIES)[keyof typeof GOOGLE_CALENDAR_EVENT_TRANSPARENCIES];

export type GoogleCalendarExtendedProperties = {
  private?: Partial<Record<typeof GOOGLE_CALENDAR_MANAGED_EVENT_PROPERTY, string>> &
    Record<string, string>;
};

export type GoogleCalendarEvent = {
  id: string;
  status?: GoogleCalendarEventStatus;
  summary?: string | null;
  location?: string | null;
  start?: GoogleCalendarEventDateTime;
  end?: GoogleCalendarEventDateTime;
  visibility?: GoogleCalendarEventVisibility;
  transparency?: GoogleCalendarEventTransparency;
  htmlLink?: string | null;
  extendedProperties?: GoogleCalendarExtendedProperties;
};

export type GoogleCalendarEventsPage = {
  items?: GoogleCalendarEvent[];
  timeZone?: string;
  nextPageToken?: string;
  nextSyncToken?: string;
};

export type GoogleCalendarEventsPageRequest =
  | { syncToken: string; pageToken?: string }
  | { timeMin: string; timeMax: string; pageToken?: string };

export type GoogleCalendar = {
  id: string;
  summary?: string | null;
  primary?: boolean;
  accessRole?: string;
  timeZone?: string;
};

export type GoogleCalendarOutboundEvent = {
  summary: string;
  description: string;
  start: GoogleCalendarEventDateTime;
  end: GoogleCalendarEventDateTime;
  location?: string;
  extendedProperties: { private: Record<typeof GOOGLE_CALENDAR_MANAGED_EVENT_PROPERTY, string> };
};

export type GoogleCalendarWatchChannel = {
  id: string;
  resourceId: string;
  expiration?: string;
};

export type GoogleCalendarWatchChannelRequest = {
  channelId: string;
  address: string;
  token: string;
  expiresAt: string;
};

export type GoogleCalendarSubscription = {
  subscriptionId: string;
  subscriptionResourceId: string;
  subscriptionClientState: string;
  subscriptionExpiresAt: string;
};

export type GoogleCalendarNotification = {
  channelId?: string;
  channelToken?: string;
  resourceState?: string;
};

export type GoogleCalendarDeltaSyncResult = {
  nextSyncToken: string;
  seenEventIds: string[];
  window: { start: string; end: string } | null;
};
