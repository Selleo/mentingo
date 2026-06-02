import {
  CALENDAR_EVENT_SOURCE_ROLES,
  CALENDAR_EVENT_SOURCE_TYPES,
  CALENDAR_EVENT_STATUSES,
  LIVE_TRAINING_DELIVERY_TYPES,
  LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES,
  LIVE_TRAINING_SESSION_STATUSES,
  LIVE_TRAINING_STATUSES,
  LIVE_TRAINING_VISIBILITY_SCOPES,
} from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const calendarEventSourceTypeSchema = Type.Enum(CALENDAR_EVENT_SOURCE_TYPES);

export const calendarEventSourceRoleSchema = Type.Enum(CALENDAR_EVENT_SOURCE_ROLES);

export const calendarEventLinkedCourseSchema = Type.Object({
  courseId: UUIDSchema,
  courseTitle: Type.String(),
});

export const calendarEventLiveTrainingPayloadSchema = Type.Object({
  deliveryType: Type.Enum(LIVE_TRAINING_DELIVERY_TYPES),
  status: Type.Enum(LIVE_TRAINING_STATUSES),
  visibilityScope: Type.Enum(LIVE_TRAINING_VISIBILITY_SCOPES),
  sourceRole: calendarEventSourceRoleSchema,
  linkedCourses: Type.Array(calendarEventLinkedCourseSchema),
});

export const calendarEventPayloadSchema = Type.Object({
  liveTraining: calendarEventLiveTrainingPayloadSchema,
});

export const calendarEventBaseSchema = Type.Object({
  id: UUIDSchema,
  uid: Type.String(),
  sourceType: calendarEventSourceTypeSchema,
  sourceId: UUIDSchema,
  title: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  startsAt: Type.String(),
  endsAt: Type.String(),
  allDay: Type.Boolean(),
  timezone: Type.String(),
  location: Type.Union([Type.String(), Type.Null()]),
  status: Type.Enum(CALENDAR_EVENT_STATUSES),
});

export const calendarEventAuthorSchema = Type.Object({
  id: UUIDSchema,
  fullName: Type.Union([Type.String(), Type.Null()]),
  email: Type.String(),
});

export const calendarEventHostSchema = Type.Object({
  userId: UUIDSchema,
  fullName: Type.Union([Type.String(), Type.Null()]),
  email: Type.String(),
  role: Type.String(),
});

export const calendarEventMaterialSchema = Type.Object({
  resourceId: UUIDSchema,
  title: Type.String(),
  mimeType: Type.Union([Type.String(), Type.Null()]),
  size: Type.Union([Type.Number(), Type.Null()]),
  relationshipType: Type.Enum(LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES),
});

export const calendarEventLatestSessionSchema = Type.Union([
  Type.Object({
    id: UUIDSchema,
    status: Type.Enum(LIVE_TRAINING_SESSION_STATUSES),
    actualStartedAt: Type.Union([Type.String(), Type.Null()]),
    actualEndedAt: Type.Union([Type.String(), Type.Null()]),
    peakParticipants: Type.Number(),
    uniqueParticipantCount: Type.Number(),
  }),
  Type.Null(),
]);

export const calendarEventLiveTrainingDetailsPayloadSchema = Type.Intersect([
  calendarEventLiveTrainingPayloadSchema,
  Type.Object({
    author: calendarEventAuthorSchema,
    hosts: Type.Array(calendarEventHostSchema),
    materials: Type.Object({
      before: Type.Array(calendarEventMaterialSchema),
      after: Type.Array(calendarEventMaterialSchema),
    }),
    latestSession: calendarEventLatestSessionSchema,
  }),
]);

export const calendarEventDetailsPayloadSchema = Type.Object({
  liveTraining: calendarEventLiveTrainingDetailsPayloadSchema,
});

export const calendarEventListItemSchema = Type.Object({
  ...calendarEventBaseSchema.properties,
  payload: calendarEventPayloadSchema,
});

export const calendarEventDetailsItemSchema = Type.Object({
  ...calendarEventBaseSchema.properties,
  payload: calendarEventDetailsPayloadSchema,
});

export type CalendarEventSourceType = Static<typeof calendarEventSourceTypeSchema>;
export type CalendarEventSourceRole = Static<typeof calendarEventSourceRoleSchema>;
export type CalendarEventLinkedCourse = Static<typeof calendarEventLinkedCourseSchema>;
export type CalendarEventBase = Static<typeof calendarEventBaseSchema>;
export type CalendarEventLiveTrainingPayload = Static<
  typeof calendarEventLiveTrainingPayloadSchema
>;
export type CalendarEventPayload = Static<typeof calendarEventPayloadSchema>;
export type CalendarEventListItem = Static<typeof calendarEventListItemSchema>;
export type CalendarEventAuthor = Static<typeof calendarEventAuthorSchema>;
export type CalendarEventHost = Static<typeof calendarEventHostSchema>;
export type CalendarEventMaterial = Static<typeof calendarEventMaterialSchema>;
export type CalendarEventLatestSession = Static<typeof calendarEventLatestSessionSchema>;
export type CalendarEventLiveTrainingDetailsPayload = Static<
  typeof calendarEventLiveTrainingDetailsPayloadSchema
>;
export type CalendarEventDetailsPayload = Static<typeof calendarEventDetailsPayloadSchema>;
export type CalendarEventDetailsItem = Static<typeof calendarEventDetailsItemSchema>;
