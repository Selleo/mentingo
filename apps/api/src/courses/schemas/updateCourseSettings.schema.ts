import { type Static, Type } from "@sinclair/typebox";

import { coursesSettingsSchema } from "../types/settings";

export const updateCourseSettingsSchema = Type.Object({
  ...Type.Partial(coursesSettingsSchema).properties,
  removeCertificateSignature: Type.Optional(Type.Boolean()),
});

export type UpdateCourseSettings = Static<typeof updateCourseSettingsSchema>;
