/** TypeBox contracts for the tenant-scoped course context sent to authoring sessions. */
import { COURSE_STATUSES, SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { coursesSettingsSchema } from "src/courses/types/settings";
import { aiJudgeConfigurationResponseSchema } from "src/lesson/ai-judge-configuration/ai-judge-configuration.schema";
import { aiMentorConfigurationResponseSchema } from "src/lesson/ai-mentor-configuration/schemas/ai-mentor-configuration.schema";

import { quizPayload } from "./course-authoring-operations.schema";

const nullableOrder = Type.Union([Type.Integer({ minimum: 0 }), Type.Null()], {
  description: "Zero-based visible sibling position; native persisted ranks are kept in baselines.",
});
const authoringCourseSettingsSchema = Type.Omit(coursesSettingsSchema, ["certificateSignature"]);
const authoringCourseSchema = Type.Object(
  {
    id: UUIDSchema,
    status: Type.Enum(COURSE_STATUSES),
    title: Type.String(),
    description: Type.String(),
    learningOutcomes: Type.Array(Type.String()),
    settings: authoringCourseSettingsSchema,
    allowedFields: Type.Array(Type.String()),
  },
  { additionalProperties: false },
);
export const authoringContextQuerySchema = Type.Object(
  {
    language: Type.Enum(SUPPORTED_LANGUAGES),
    lessonIds: Type.Optional(Type.Array(UUIDSchema, { maxItems: 100 })),
  },
  { additionalProperties: false },
);

export const authoringCourseContextSchema = Type.Object({
  courseId: UUIDSchema,
  language: Type.Enum(SUPPORTED_LANGUAGES),
  course: authoringCourseSchema,
  title: Type.String(),
  description: Type.String(),
  baselineHash: Type.String(),
  fieldHashes: Type.Record(Type.String(), Type.String()),
  chapters: Type.Array(
    Type.Object({
      id: UUIDSchema,
      title: Type.String(),
      displayOrder: nullableOrder,
      baselineHash: Type.String(),
      deletionBaselineHash: Type.String(),
      lessons: Type.Array(
        Type.Object({
          id: UUIDSchema,
          title: Type.String(),
          lessonType: Type.String(),
          assessmentAttemptCount: Type.Integer({ minimum: 0 }),
          displayOrder: nullableOrder,
          baselineHash: Type.String(),
          description: Type.Optional(Type.String()),
          quiz: Type.Optional(quizPayload),
          mentorConfiguration: Type.Optional(aiMentorConfigurationResponseSchema),
          judgeConfiguration: Type.Optional(
            Type.Union([aiJudgeConfigurationResponseSchema, Type.Null()]),
          ),
          blocks: Type.Optional(
            Type.Array(
              Type.Object({ id: UUIDSchema, html: Type.String(), baselineHash: Type.String() }),
            ),
          ),
        }),
      ),
    }),
  ),
});

export const authoringContextResponseSchema = Type.Object({ data: authoringCourseContextSchema });
export type AuthoringContextQuery = Static<typeof authoringContextQuerySchema>;
export type AuthoringCourseContext = Static<typeof authoringCourseContextSchema>;
