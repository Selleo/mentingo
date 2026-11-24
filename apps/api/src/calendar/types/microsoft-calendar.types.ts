import type {
  CalendarConnection,
  CalendarConnectionCreateInput,
  CalendarConnectionUpdate,
  CalendarOutboundCandidate,
  EncryptedCalendarRefreshToken,
  MappedExternalCalendarEvent,
} from "./calendar-connection.types";
import type {
  MICROSOFT_CALENDAR_GRAPH_SENSITIVITIES,
  MICROSOFT_CALENDAR_GRAPH_SHOW_AS,
  MICROSOFT_CALENDAR_LIFECYCLE_EVENTS,
  MICROSOFT_CALENDAR_OAUTH_PURPOSE,
} from "../calendar.constants";
import type { UUIDType } from "src/common";

export type MicrosoftCalendarConnection = CalendarConnection;

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

export type EncryptedMicrosoftRefreshToken = EncryptedCalendarRefreshToken;

export type MicrosoftCalendarConnectionCreateInput = CalendarConnectionCreateInput;

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

export type OutboundCandidate = CalendarOutboundCandidate;

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

export type MappedMicrosoftCalendarEvent = MappedExternalCalendarEvent;

export type MicrosoftCalendarConnectionUpdate = CalendarConnectionUpdate;
