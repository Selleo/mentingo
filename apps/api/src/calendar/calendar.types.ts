import type {
  CalendarEventSourceType,
  CalendarEventStatus,
  LiveTrainingDeliveryType,
  LiveTrainingMemberRole,
  LiveTrainingResourceRelationshipType,
  LiveTrainingSessionStatus,
  LiveTrainingStatus,
  LiveTrainingVisibilityScope,
} from "@repo/shared";
import type { SQL } from "drizzle-orm";
import type { UUIDType } from "src/common";

export type CalendarEventListConditions = SQL[];

export type CalendarEventSourcePayload = LiveTrainingCalendarEventPayload;

export type LiveTrainingCalendarEventPayload = {
  liveTraining: {
    deliveryType: LiveTrainingDeliveryType;
    status: LiveTrainingStatus;
    visibilityScope: LiveTrainingVisibilityScope;
    linkedCourses: CalendarEventLinkedCourse[];
  };
};

export type CalendarEventNormalizedRow = {
  id: UUIDType;
  uid: string;
  sourceType: CalendarEventSourceType;
  sourceId: UUIDType;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  timezone: string;
  location: string | null;
  status: CalendarEventStatus;
  payload: CalendarEventSourcePayload;
  authorId: UUIDType;
};

export type CalendarEventLinkedCourse = {
  courseId: UUIDType;
  courseTitle: string;
};

export type CalendarEventLinkedCourseRow = CalendarEventLinkedCourse & {
  eventId: UUIDType;
};

export type CalendarEventHostRow = {
  eventId: UUIDType;
  userId: UUIDType;
  fullName: string | null;
  email: string;
  role: LiveTrainingMemberRole;
};

export type CalendarEventAuthorRow = {
  id: UUIDType;
  fullName: string | null;
  email: string;
};

export type CalendarEventMaterialRow = {
  resourceId: UUIDType;
  title: string;
  mimeType: string | null;
  size: number | null;
  relationshipType: LiveTrainingResourceRelationshipType;
};

export type CalendarEventLatestSessionRow = {
  id: UUIDType;
  status: LiveTrainingSessionStatus;
  actualStartedAt: string | null;
  actualEndedAt: string | null;
  peakParticipants: number;
  uniqueParticipantCount: number;
};

export type CalendarEventRoleContext = {
  authorId: UUIDType;
  hostIds: UUIDType[];
};
