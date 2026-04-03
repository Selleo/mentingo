import { type Static, Type } from "@sinclair/typebox";

export const updateCourseSettingsSchema = Type.Object({
  lessonSequenceEnabled: Type.Optional(Type.Boolean()),
  quizFeedbackEnabled: Type.Optional(Type.Boolean()),
  certificateFontColor: Type.Optional(Type.String()),
  removeCertificateSignature: Type.Optional(Type.Boolean()),
  certificateSignature: Type.Optional(Type.String({ format: "binary" })),
});

export type UpdateCourseSettings = Static<typeof updateCourseSettingsSchema>;
