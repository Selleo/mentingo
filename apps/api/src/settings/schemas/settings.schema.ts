import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import type { Static } from "@sinclair/typebox";

export const settingsJSONContentSchema = Type.Object({
  adminNewUserNotification: Type.Optional(Type.Boolean()),
  language: Type.Optional(Type.String()),
});

export const settingsSchema = Type.Object({
  userId: UUIDSchema,
  settings: settingsJSONContentSchema,
  createdAt: Type.Union([Type.String(), Type.Null()]),
});

export type SettingsSchema = Static<typeof settingsSchema>;
export type SettingsJSONContentSchema = Static<typeof settingsJSONContentSchema>;
