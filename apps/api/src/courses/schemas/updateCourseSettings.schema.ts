import { type Static, Type } from "@sinclair/typebox";

import { coursesSettingsSchema } from "../types/settings";

export const updateCourseSettingsSchema = Type.Object({
  ...Type.Partial(coursesSettingsSchema).properties,
  removeCertificateSignature: Type.Optional(Type.Boolean()),
});

export const updateCourseSettingsMultipartSchema = Type.Object({
  ...updateCourseSettingsSchema.properties,
  certificateSignature: Type.Optional(Type.Unknown()),
});

export type UpdateCourseSettings = Static<typeof updateCourseSettingsSchema>;
