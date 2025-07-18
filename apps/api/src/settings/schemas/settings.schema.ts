import { Type } from "@sinclair/typebox";

import type { Static } from "@sinclair/typebox";

export const companyInformationJSONSchema = Type.Object({
  companyName: Type.Optional(Type.String()),
  registeredAddress: Type.Optional(Type.String()),
  taxNumber: Type.Optional(Type.String()),
  emailAddress: Type.Optional(Type.String()),
  courtRegisterNumber: Type.Optional(Type.String()),
});

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
  globalSettingsJSONSchema
]);

export const userSettingsJSONContentSchema = Type.Union([
  studentSettingsJSONContentSchema,
  adminSettingsJSONContentSchema,
]);


export type SettingsJSONContentSchema = Static<typeof settingsJSONContentSchema>;
export type StudentSettingsJSONContentSchema = Static<typeof studentSettingsJSONContentSchema>;
export type AdminSettingsJSONContentSchema = Static<typeof adminSettingsJSONContentSchema>;
export type GlobalSettingsJSONContentSchema = Static<typeof globalSettingsJSONSchema>;
export type CompanyInformationJSONSchema = Static<typeof companyInformationJSONSchema>;