import type { CalendarOutboundErrorCode, CalendarOutboundSourceType } from "../calendar.constants";
import type {
  CalendarConnectionStatus,
  CalendarOutboundStatus,
  CalendarProvider,
  OutlookEventAvailability,
  OutlookEventSensitivity,
} from "@repo/shared";
import type { UUIDType } from "src/common";
import type { calendarConnections } from "src/storage/schema";

export type CalendarConnection = typeof calendarConnections.$inferSelect;

export type CalendarConnectionOwner = Pick<CalendarConnection, "id" | "userId" | "provider">;

export type EncryptedCalendarRefreshToken = {
  refreshTokenCiphertext: string;
  refreshTokenIv: string;
  refreshTokenTag: string;
  refreshTokenEncryptedDek: string;
  refreshTokenEncryptedDekIv: string;
  refreshTokenEncryptedDekTag: string;
};

export type CalendarConnectionCreateInput = {
  userId: UUIDType;
  provider: CalendarProvider;
  accountId: string;
  accountEmail: string;
  encryptedRefreshToken: EncryptedCalendarRefreshToken;
};

export type CalendarConnectionUpdate = Partial<{
  accountId: string;
  accountEmail: string;
  status: CalendarConnectionStatus;
  errorCode: string | null;
  syncCursor: string | null;
  syncWindowStart: string | null;
  syncWindowEnd: string | null;
  windowBuiltAt: string | null;
  lastSuccessfulSyncAt: string | null;
  lastSyncCompletedAt: string | null;
  subscriptionId: string | null;
  subscriptionResourceId: string | null;
  subscriptionClientState: string | null;
  subscriptionExpiresAt: string | null;
  outboundSyncEnabled: boolean;
  outboundStatus: CalendarOutboundStatus;
  outboundCalendarId: string | null;
  outboundErrorCode: CalendarOutboundErrorCode | null;
  lastOutboundSyncAt: string | null;
}> &
  Partial<EncryptedCalendarRefreshToken>;

export type MappedExternalCalendarEvent = {
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

export type CalendarOutboundCandidate = {
  calendarEventId: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  timezone: string;
  location: string | null;
  sourceType: CalendarOutboundSourceType;
  groupName: string | null;
  courseTitle: string | null;
  recipientId: string;
};

export type CalendarOutboundMappingInput = {
  connectionId: UUIDType;
  calendarEventId: UUIDType;
  userId: UUIDType;
  externalEventId: string;
};
