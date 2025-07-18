import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import type { Static } from "@sinclair/typebox";

export const baseSettingsJSONContentSchema = Type.Object({
  language: Type.Optional(Type.String()),
});

export const studentSettingsJSONContentSchema = Type.Object({
  ...baseSettingsJSONContentSchema.properties,
});

export const adminSettingsJSONContentSchema = Type.Object({
  ...baseSettingsJSONContentSchema.properties,
  adminNewUserNotification: Type.Optional(Type.Boolean()),
});

export const settingsJSONContentSchema = Type.Union([
  studentSettingsJSONContentSchema,
  adminSettingsJSONContentSchema,
]);

export const settingsSchema = Type.Object({
  userId: UUIDSchema,
  settings: settingsJSONContentSchema,
  createdAt: Type.Union([Type.String(), Type.Null()]),
});

export type SettingsSchema = Static<typeof settingsSchema>;
export type SettingsJSONContentSchema = Static<typeof settingsJSONContentSchema>;
export type StudentSettingsJSONContentSchema = Static<typeof studentSettingsJSONContentSchema>;
export type AdminSettingsJSONContentSchema = Static<typeof adminSettingsJSONContentSchema>;
