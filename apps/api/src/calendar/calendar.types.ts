import type {
  CalendarEventSourceRole,
  CalendarEventSourceType,
  CalendarEventStatus,
  LiveTrainingDeliveryType,
  LiveTrainingMemberRole,
  LiveTrainingResourceRelationshipType,
  LiveTrainingSessionStatus,
  LiveTrainingStatus,
  LiveTrainingVisibilityScope,
  LocalizedText,
  SupportedLanguages,
} from "@repo/shared";
import type { SQL } from "drizzle-orm";
import type { UUIDType } from "src/common";
import type { calendarEvents } from "src/storage/schema";

export type CalendarEventListConditions = SQL[];

export type CalendarEventInsert = typeof calendarEvents.$inferInsert;

export type CourseDueDateCalendarEventUpsertInput = {
  calendarEvent: CalendarEventInsert & { uid: string };
  courseId: UUIDType;
  groupId: UUIDType;
};

export type CalendarEventSourcePayload =
  | LiveTrainingCalendarEventPayload
  | CourseDueDateCalendarEventPayload;

export type LiveTrainingCalendarEventPayload = {
  liveTraining: {
    deliveryType: LiveTrainingDeliveryType;
    status: LiveTrainingStatus;
    visibilityScope: LiveTrainingVisibilityScope;
    linkedCourses: CalendarEventLinkedCourse[];
  };
};

export type LiveTrainingListItemPayload = {
  liveTraining: LiveTrainingCalendarEventPayload["liveTraining"] & {
    sourceRole: CalendarEventSourceRole;
  };
};

export type CourseDueDateCalendarEventPayload = {
  courseDueDate: {
    courseId: UUIDType;
    courseTitle: string;
    groupId: UUIDType;
    groupName: string;
    dueDate: string;
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
  authorId: UUIDType | null;
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

export type GroupCourseDueDateRow = {
  courseId: UUIDType;
  groupId: UUIDType;
  dueDate: string;
  calendarEventId: UUIDType | null;
  courseTitle: LocalizedText;
  courseBaseLanguage: SupportedLanguages;
  courseAvailableLocales: SupportedLanguages[];
};
