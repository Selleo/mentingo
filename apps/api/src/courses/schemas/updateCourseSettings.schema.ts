import { type Static, Type } from "@sinclair/typebox";

import { coursesSettingsSchema } from "../types/settings";

const multipartBooleanSchema = Type.Union([Type.Boolean(), Type.String()]);

export const updateCourseSettingsSchema = Type.Object({
  ...Type.Partial(coursesSettingsSchema).properties,
  removeCertificateSignature: Type.Optional(Type.Boolean()),
});

export const updateCourseSettingsMultipartSchema = Type.Object({
  lessonSequenceEnabled: Type.Optional(multipartBooleanSchema),
  quizFeedbackEnabled: Type.Optional(multipartBooleanSchema),
  certificateFontColor: Type.Optional(Type.String()),
  removeCertificateSignature: Type.Optional(multipartBooleanSchema),
  certificateSignature: Type.Optional(Type.String({ format: "binary" })),
});

export type UpdateCourseSettings = Static<typeof updateCourseSettingsSchema>;
export type UpdateCourseSettingsMultipart = Static<typeof updateCourseSettingsMultipartSchema>;
