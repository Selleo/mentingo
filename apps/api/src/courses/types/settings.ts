import { Type, type Static } from "@sinclair/typebox";

import { LESSON_SEQUENCE_ENABLED, QUIZ_FEEDBACK_ENABLED } from "../constants";

export const coursesSettingsSchema = Type.Object(
  {
    lessonSequenceEnabled: Type.Boolean({
      default: LESSON_SEQUENCE_ENABLED,
    }),
    quizFeedbackEnabled: Type.Boolean({
      default: QUIZ_FEEDBACK_ENABLED,
    }),
    certificateSignature: Type.Union([Type.String(), Type.Null()], {
      default: null,
    }),
    certificateFontColor: Type.Union([Type.String(), Type.Null()], {
      default: null,
    }),
  },
  {
    additionalProperties: false,
  },
);

export type CoursesSettings = Static<typeof coursesSettingsSchema>;
