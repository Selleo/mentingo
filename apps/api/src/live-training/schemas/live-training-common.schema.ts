import {
  LIVE_TRAINING_DELIVERY_TYPES,
  LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES,
  LIVE_TRAINING_STATUSES,
  LIVE_TRAINING_VISIBILITY_SCOPES,
  SUPPORTED_LANGUAGES,
} from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

export const localizedTextSchema = Type.Partial(
  Type.Record(Type.Enum(SUPPORTED_LANGUAGES), Type.String({ minLength: 1 })),
);

export const nullableLocalizedTextSchema = Type.Union([localizedTextSchema, Type.Null()]);

export const liveTrainingDeliveryTypeSchema = Type.Enum(LIVE_TRAINING_DELIVERY_TYPES);

export const liveTrainingVisibilityScopeSchema = Type.Enum(LIVE_TRAINING_VISIBILITY_SCOPES);

export const liveTrainingStatusSchema = Type.Enum(LIVE_TRAINING_STATUSES);

export const liveTrainingSettingsSchema = Type.Object({
  viewerPermissions: Type.Object({
    microphoneEnabled: Type.Boolean(),
    cameraEnabled: Type.Boolean(),
  }),
});

export const updateLiveTrainingSettingsSchema = Type.Partial(
  Type.Object({
    viewerPermissions: Type.Optional(
      Type.Partial(
        Type.Object({
          microphoneEnabled: Type.Boolean(),
          cameraEnabled: Type.Boolean(),
        }),
      ),
    ),
  }),
);

export const liveTrainingUserSummarySchema = Type.Object({
  id: UUIDSchema,
  fullName: Type.Union([Type.String(), Type.Null()]),
  profilePictureUrl: Type.Union([Type.String(), Type.Null()]),
});

export const liveTrainingCourseSummarySchema = Type.Object({
  id: UUIDSchema,
  title: Type.String(),
});

export const liveTrainingMaterialSchema = Type.Object({
  resourceId: UUIDSchema,
  title: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  contentType: Type.String(),
  fileUrl: Type.String(),
  relationshipType: Type.Enum(LIVE_TRAINING_RESOURCE_RELATIONSHIP_TYPES),
});

export const liveTrainingBaseSchema = Type.Object({
  id: UUIDSchema,
  calendarEventId: UUIDSchema,
  title: Type.String(),
  description: Type.Union([Type.String(), Type.Null()]),
  startsAt: Type.String(),
  endsAt: Type.String(),
  allDay: Type.Boolean(),
  timezone: Type.String(),
  location: Type.Union([Type.String(), Type.Null()]),
  deliveryType: liveTrainingDeliveryTypeSchema,
  visibilityScope: liveTrainingVisibilityScopeSchema,
  status: liveTrainingStatusSchema,
  maxParticipants: Type.Number(),
  authorId: UUIDSchema,
  trainerIds: Type.Array(UUIDSchema),
  linkedCourseIds: Type.Array(UUIDSchema),
});

export const liveTrainingDeleteResponseSchema = Type.Object({ message: Type.String() });

export type LiveTrainingBase = Static<typeof liveTrainingBaseSchema>;
export type LiveTrainingUserSummary = Static<typeof liveTrainingUserSummarySchema>;
export type LiveTrainingCourseSummary = Static<typeof liveTrainingCourseSummarySchema>;
export type LiveTrainingMaterial = Static<typeof liveTrainingMaterialSchema>;
export type LiveTrainingDeleteResponse = Static<typeof liveTrainingDeleteResponseSchema>;
