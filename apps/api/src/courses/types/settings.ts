import { CERTIFICATE_VALIDITY_TYPES, CERTIFICATE_VALIDITY_UNITS } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";

import { LESSON_SEQUENCE_ENABLED, QUIZ_FEEDBACK_ENABLED } from "../constants";

export const certificateValiditySchema = Type.Union([
  Type.Object(
    {
      type: Type.Literal(CERTIFICATE_VALIDITY_TYPES.PERIOD),
      value: Type.Number({ minimum: 1 }),
      unit: Type.Enum(CERTIFICATE_VALIDITY_UNITS),
    },
    { additionalProperties: false },
  ),
  Type.Object(
    {
      type: Type.Literal(CERTIFICATE_VALIDITY_TYPES.FIXED_DATE),
      date: Type.String({ format: "date" }),
    },
    { additionalProperties: false },
  ),
]);

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
    certificateValidity: Type.Union([certificateValiditySchema, Type.Null()], {
      default: null,
    }),
  },
  {
    additionalProperties: false,
  },
);

export type CoursesSettings = Static<typeof coursesSettingsSchema>;
export type CertificateValidity = Static<typeof certificateValiditySchema>;
