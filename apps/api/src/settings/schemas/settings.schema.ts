import { Type } from "@sinclair/typebox";

import type { Static } from "@sinclair/typebox";

export const studentSettingsJSONContentSchema = Type.Object({
  language: Type.String(),
});

export const globalSettingsJSONSchema = Type.Object({
  unregisteredUserCoursesAccessibility: Type.Boolean(),
  platformLogoS3Key: Type.Union([Type.String(), Type.Null()]),
});

export const adminSettingsJSONContentSchema = Type.Object({
  language: Type.String(),
  adminNewUserNotification: Type.Boolean(),
});

export const globalSettingsJSONContentSchema = Type.Object({
  platformLogoS3Key: Type.Union([Type.String(), Type.Null()]),
});

export const settingsJSONContentSchema = Type.Union([
  studentSettingsJSONContentSchema,
  adminSettingsJSONContentSchema,
  globalSettingsJSONContentSchema,
]);

export type SettingsJSONContentSchema = Static<typeof settingsJSONContentSchema>;
export type StudentSettingsJSONContentSchema = Static<typeof studentSettingsJSONContentSchema>;
export type AdminSettingsJSONContentSchema = Static<typeof adminSettingsJSONContentSchema>;
export type GlobalSettingsJSONContentSchema = Static<typeof globalSettingsJSONSchema>;
