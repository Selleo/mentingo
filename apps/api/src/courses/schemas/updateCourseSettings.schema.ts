import { type Static, Type } from "@sinclair/typebox";

import { certificateValiditySchema } from "../types/settings";

export const updateCourseSettingsSchema = Type.Object({
  lessonSequenceEnabled: Type.Optional(Type.Boolean()),
  quizFeedbackEnabled: Type.Optional(Type.Boolean()),
  videoCompletionTrackingEnabled: Type.Optional(Type.Boolean()),
  certificateFontColor: Type.Optional(Type.String()),
  certificateValidity: Type.Optional(Type.Union([certificateValiditySchema, Type.Null()])),
  applyValidityToExistingCertificates: Type.Optional(Type.Boolean()),
  removeCertificateSignature: Type.Optional(Type.Boolean()),
  certificateSignature: Type.Optional(Type.String({ format: "binary" })),
});

export type UpdateCourseSettings = Static<typeof updateCourseSettingsSchema>;
