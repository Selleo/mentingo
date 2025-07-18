import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import type { Static } from "@sinclair/typebox";

export const companyInformationSchema = Type.Object({
  company_name: Type.Optional(Type.String()),
  registered_address: Type.Optional(Type.String()),
  tax_number: Type.Optional(Type.String()),
  email_address: Type.Optional(Type.String()),
  court_register_number: Type.Optional(Type.String()),
});

export const settingsJSONContentSchema = Type.Object({
  admin_new_user_notification: Type.Optional(Type.Boolean()),
  language: Type.Optional(Type.String()),
  company_information: Type.Optional(companyInformationSchema),
});

export const settingsSchema = Type.Object({
  userId: UUIDSchema,
  settings: settingsJSONContentSchema,
  createdAt: Type.Union([Type.String(), Type.Null()]),
});

export const globalSettingsSchema = Type.Object({
  userId: Type.Union([UUIDSchema, Type.Null()]),
  settings: settingsJSONContentSchema,
  createdAt: Type.Union([Type.String(), Type.Null()]),
});

export type SettingsSchema = Static<typeof settingsSchema>;
export type GlobalSettingsSchema = Static<typeof globalSettingsSchema>;
export type SettingsJSONContentSchema = Static<typeof settingsJSONContentSchema>;
export type CompanyInformationSchema = Static<typeof companyInformationSchema>;
