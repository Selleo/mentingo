import { Type, type Static } from "@sinclair/typebox";

import { coursesSettingsSchema } from "../types/settings";

export const getCourseSettingsSchema = Type.Object({
  ...coursesSettingsSchema.properties,
  certificateSignatureUrl: Type.Union([Type.String(), Type.Null()]),
});

export type GetCourseSettings = Static<typeof getCourseSettingsSchema>;

export { coursesSettingsSchema, type CoursesSettings as CourseSettings } from "../types/settings";
