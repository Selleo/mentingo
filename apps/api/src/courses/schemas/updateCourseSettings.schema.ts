import { type Static, Type } from "@sinclair/typebox";

import { coursesSettingsSchema } from "../types/settings";

export const updateCourseSettingsSchema = Type.Partial(coursesSettingsSchema);

export type UpdateCourseSettings = Static<typeof updateCourseSettingsSchema>;
