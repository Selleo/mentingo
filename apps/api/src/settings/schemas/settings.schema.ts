import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import type { Static } from "@sinclair/typebox";

export const studentSettingsJSONContentSchema = Type.Object({
  language: Type.String(),
});

export const companyInformationSchema = Type.Object({
  company_name: Type.Optional(Type.String()),
  registered_address: Type.Optional(Type.String()),
  tax_number: Type.Optional(Type.String()),
  email_address: Type.Optional(Type.String()),
  court_register_number: Type.Optional(Type.String()),
});

export const adminSettingsJSONContentSchema = Type.Object({
  ...studentSettingsJSONContentSchema.properties,
  adminNewUserNotification: Type.Boolean(),
  company_information: Type.Optional(companyInformationSchema),
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

export const globalSettingsSchema = Type.Object({
  userId: Type.Union([UUIDSchema, Type.Null()]),
  settings: settingsJSONContentSchema,
  createdAt: Type.Union([Type.String(), Type.Null()]),
});

export type SettingsSchema = Static<typeof settingsSchema>;
export type SettingsJSONContentSchema = Static<typeof settingsJSONContentSchema>;
export type GlobalSettingsSchema = Static<typeof globalSettingsSchema>;
export type StudentSettingsJSONContentSchema = Static<typeof studentSettingsJSONContentSchema>;
export type AdminSettingsJSONContentSchema = Static<typeof adminSettingsJSONContentSchema>;
