import type {
  MICROSOFT_CALENDAR_GRAPH_SENSITIVITIES,
  MICROSOFT_CALENDAR_GRAPH_SHOW_AS,
  MICROSOFT_CALENDAR_LIFECYCLE_EVENTS,
  MICROSOFT_CALENDAR_OAUTH_PURPOSE,
  MicrosoftCalendarOutboundErrorCode,
  MicrosoftCalendarOutboundSourceType,
} from "../calendar.constants";
import type {
  CALENDAR_PROVIDERS,
  MicrosoftCalendarConnectionStatus,
  MicrosoftCalendarOutboundStatus,
  OutlookEventAvailability,
  OutlookEventSensitivity,
} from "@repo/shared";
import type { UUIDType } from "src/common";
import type { calendarConnections } from "src/storage/schema";

export type MicrosoftCalendarConnection = typeof calendarConnections.$inferSelect;

export const MICROSOFT_CALENDAR_SYNC_REASONS = {
  INITIAL: "initial",
  AUTHORIZATION: "authorization",
  MANUAL: "manual",
  WEBHOOK: "webhook",
  RECONCILIATION: "reconciliation",
  LIFECYCLE: "lifecycle",
} as const;

export type MicrosoftCalendarSyncReason =
  (typeof MICROSOFT_CALENDAR_SYNC_REASONS)[keyof typeof MICROSOFT_CALENDAR_SYNC_REASONS];

export type EncryptedMicrosoftRefreshToken = {
  refreshTokenCiphertext: string;
  refreshTokenIv: string;
  refreshTokenTag: string;
  refreshTokenEncryptedDek: string;
  refreshTokenEncryptedDekIv: string;
  refreshTokenEncryptedDekTag: string;
};

export type MicrosoftCalendarConnectionCreateInput = {
  userId: UUIDType;
  provider: typeof CALENDAR_PROVIDERS.MICROSOFT;
  accountId: string;
  accountEmail: string;
  encryptedRefreshToken: EncryptedMicrosoftRefreshToken;
};

export type MicrosoftCalendarSyncJobData = {
  tenantId: UUIDType;
  connectionId: UUIDType;
  fullSync: boolean;
  reason: MicrosoftCalendarSyncReason;
};

export type MicrosoftCalendarOutboundJobData = {
  tenantId: UUIDType;
  connectionId: UUIDType;
  reason: MicrosoftCalendarSyncReason;
};

export type OutboundCandidate = {
  calendarEventId: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  timezone: string;
  location: string | null;
  sourceType: MicrosoftCalendarOutboundSourceType;
  groupName: string | null;
  courseTitle: string | null;
  recipientId: string;
};

export type MicrosoftCalendarOAuthState = {
  tenantId: UUIDType;
  userId: UUIDType;
  purpose: typeof MICROSOFT_CALENDAR_OAUTH_PURPOSE;
  nonce: string;
  replace: boolean;
  outboundSync?: boolean;
  origin: string;
  iat: number;
  exp: number;
};

export type MicrosoftTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
};

export type MicrosoftGraphProfile = {
  id: string;
  mail: string | null;
  userPrincipalName: string;
};

export type MicrosoftGraphDateTime = {
  dateTime: string;
  timeZone: string;
};

export type MicrosoftGraphEvent = {
  id: string;
  subject?: string | null;
  start: MicrosoftGraphDateTime;
  end: MicrosoftGraphDateTime;
  isAllDay?: boolean;
  location?: { displayName?: string | null } | null;
  isCancelled?: boolean;
  showAs?: (typeof MICROSOFT_CALENDAR_GRAPH_SHOW_AS)[keyof typeof MICROSOFT_CALENDAR_GRAPH_SHOW_AS];
  webLink?: string | null;
  sensitivity?: (typeof MICROSOFT_CALENDAR_GRAPH_SENSITIVITIES)[keyof typeof MICROSOFT_CALENDAR_GRAPH_SENSITIVITIES];
  "@removed"?: { reason?: string };
  singleValueExtendedProperties?: Array<{ id: string; value?: string }>;
};

export type MicrosoftGraphCalendar = {
  id: string;
  name?: string | null;
  isDefaultCalendar?: boolean;
};

export type MicrosoftGraphOutboundEvent = {
  subject: string;
  body: { contentType: "HTML"; content: string };
  start: MicrosoftGraphDateTime;
  end: MicrosoftGraphDateTime;
  isAllDay: boolean;
  location?: { displayName: string };
  singleValueExtendedProperties: Array<{ id: string; value: string }>;
};

export type MicrosoftGraphDeltaPage = {
  value: MicrosoftGraphEvent[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
};

export type MicrosoftGraphSubscription = {
  id: string;
  expirationDateTime: string;
};

export type MicrosoftGraphNotification = {
  subscriptionId?: string;
  clientState?: string;
  lifecycleEvent?: (typeof MICROSOFT_CALENDAR_LIFECYCLE_EVENTS)[keyof typeof MICROSOFT_CALENDAR_LIFECYCLE_EVENTS];
};

export type MicrosoftGraphNotificationBody = {
  value?: MicrosoftGraphNotification[];
};

export type MappedMicrosoftCalendarEvent = {
  externalEventId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  timezone: string;
  location: string | null;
  isCancelled: boolean;
  availability: OutlookEventAvailability;
  sensitivity: OutlookEventSensitivity;
  webLink: string | null;
};

export type MicrosoftCalendarConnectionUpdate = Partial<{
  accountId: string;
  accountEmail: string;
  status: MicrosoftCalendarConnectionStatus;
  errorCode: string | null;
  syncCursor: string | null;
  syncWindowStart: string | null;
  syncWindowEnd: string | null;
  windowBuiltAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastSyncCompletedAt: string | null;
  subscriptionId: string | null;
  subscriptionClientState: string | null;
  subscriptionExpiresAt: string | null;
  outboundSyncEnabled: boolean;
  outboundStatus: MicrosoftCalendarOutboundStatus;
  outboundCalendarId: string | null;
  outboundErrorCode: MicrosoftCalendarOutboundErrorCode | null;
  lastOutboundSyncAt: string | null;
}> &
  Partial<EncryptedMicrosoftRefreshToken>;
