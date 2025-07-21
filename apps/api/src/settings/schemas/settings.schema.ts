import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import type { Static } from "@sinclair/typebox";

export const studentSettingsJSONContentSchema = Type.Object({
  language: Type.String(),
});

export const adminSettingsJSONContentSchema = Type.Object({
  ...studentSettingsJSONContentSchema.properties,
  adminNewUserNotification: Type.Boolean(),
});

export const settingsJSONContentSchema = Type.Union([
  studentSettingsJSONContentSchema,
  adminSettingsJSONContentSchema,
]);

export const settingsSchema = Type.Object({
  userId: UUIDSchema,
  settings: Type.Union([studentSettingsJSONContentSchema, adminSettingsJSONContentSchema]),
  createdAt: Type.Union([Type.String(), Type.Null()]),
});

export type SettingsSchema = Static<typeof settingsSchema>;
export type SettingsJSONContentSchema = Static<typeof settingsJSONContentSchema>;
export type StudentSettingsJSONContentSchema = Static<typeof studentSettingsJSONContentSchema>;
export type AdminSettingsJSONContentSchema = Static<typeof adminSettingsJSONContentSchema>;
