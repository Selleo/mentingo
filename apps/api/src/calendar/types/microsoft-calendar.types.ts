import type {
  MicrosoftCalendarConnectionStatus,
  MicrosoftCalendarOutboundStatus,
  OutlookEventAvailability,
  OutlookEventSensitivity,
} from "@repo/shared";
import type { UUIDType } from "src/common";
import type { microsoftCalendarConnections } from "src/storage/schema";

export type MicrosoftCalendarConnection = typeof microsoftCalendarConnections.$inferSelect;

export const MICROSOFT_CALENDAR_SYNC_REASONS = {
  INITIAL: "initial",
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
  microsoftAccountId: string;
  microsoftEmail: string;
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
  reason: string;
};

export type OutboundCandidate = {
  calendarEventId: string;
  title: Record<string, string> | null;
  description: Record<string, string> | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  timezone: string;
  location: string | null;
  sourceType: "live_training" | "course_due_date";
  groupName: string | null;
  courseTitle: string | null;
  recipientId: string;
};

export type MicrosoftCalendarOAuthState = {
  tenantId: UUIDType;
  userId: UUIDType;
  purpose: "microsoft_calendar";
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
  showAs?: "free" | "tentative" | "busy" | "oof" | "workingElsewhere" | "unknown";
  webLink?: string | null;
  sensitivity?: "normal" | "personal" | "private" | "confidential" | "unknown";
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
  lifecycleEvent?: "missed" | "reauthorizationRequired" | "subscriptionRemoved";
};

export type MicrosoftGraphNotificationBody = {
  value?: MicrosoftGraphNotification[];
};

export type MappedMicrosoftCalendarEvent = {
  microsoftEventId: string;
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
  microsoftAccountId: string;
  microsoftEmail: string;
  status: MicrosoftCalendarConnectionStatus;
  errorCode: string | null;
  deltaLink: string | null;
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
  outboundErrorCode: string | null;
  lastOutboundSyncAt: string | null;
}> &
  Partial<EncryptedMicrosoftRefreshToken>;
