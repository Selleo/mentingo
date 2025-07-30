import { Type } from "@sinclair/typebox";

import type { Static } from "@sinclair/typebox";

export const studentSettingsJSONContentSchema = Type.Object({
  language: Type.String(),
});

export const globalSettingsJSONSchema = Type.Object({
  unregisteredUserCoursesAccessibility: Type.Boolean(),
});

export const adminSettingsJSONContentSchema = Type.Object({
  language: Type.String(),
  adminNewUserNotification: Type.Boolean(),
});

export const settingsJSONContentSchema = Type.Union([
  studentSettingsJSONContentSchema,
  adminSettingsJSONContentSchema,
]);

export type SettingsJSONContentSchema = Static<typeof settingsJSONContentSchema>;
export type StudentSettingsJSONContentSchema = Static<typeof studentSettingsJSONContentSchema>;
export type AdminSettingsJSONContentSchema = Static<typeof adminSettingsJSONContentSchema>;
export type GlobalSettingsJSONContentSchema = Static<typeof globalSettingsJSONSchema>;
