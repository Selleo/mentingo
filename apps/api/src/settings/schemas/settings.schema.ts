import { Type } from "@sinclair/typebox";

import { USER_ROLES } from "src/user/schemas/userRoles";

import { ALLOWED_CURRENCIES } from "../constants/settings.constants";

import type { Static } from "@sinclair/typebox";

export const companyInformationJSONSchema = Type.Object({
  companyName: Type.Optional(Type.String()),
  registeredAddress: Type.Optional(Type.String()),
  taxNumber: Type.Optional(Type.String()),
  emailAddress: Type.Optional(Type.String()),
  courtRegisterNumber: Type.Optional(Type.String()),
});

export const globalSettingsJSONSchema = Type.Object({
  unregisteredUserCoursesAccessibility: Type.Boolean(),
  enforceSSO: Type.Boolean(),
  certificateBackgroundImage: Type.Union([Type.String(), Type.Null()]),
  companyInformation: Type.Optional(companyInformationJSONSchema),
  platformLogoS3Key: Type.Union([Type.String(), Type.Null()]),
  MFAEnforcedRoles: Type.Array(Type.Enum(USER_ROLES)),
  defaultCourseCurrency: Type.Union(ALLOWED_CURRENCIES.map((currency) => Type.Literal(currency))),
  inviteOnlyRegistration: Type.Boolean(),
});

export const studentSettingsJSONContentSchema = Type.Object({
  language: Type.String(),
  isMFAEnabled: Type.Boolean({ default: false }),
  MFASecret: Type.Union([Type.String({ default: null }), Type.Null()]),
});

export const adminSettingsJSONContentSchema = Type.Object({
  ...studentSettingsJSONContentSchema.properties,
  adminNewUserNotification: Type.Boolean(),
  adminFinishedCourseNotification: Type.Boolean(),
});

export const settingsJSONContentSchema = Type.Union([
  studentSettingsJSONContentSchema,
  adminSettingsJSONContentSchema,
]);

export const userSettingsJSONContentSchema = Type.Union([
  studentSettingsJSONContentSchema,
  adminSettingsJSONContentSchema,
]);

export type SettingsJSONContentSchema = Static<typeof settingsJSONContentSchema>;
export type StudentSettingsJSONContentSchema = Static<typeof studentSettingsJSONContentSchema>;
export type AdminSettingsJSONContentSchema = Static<typeof adminSettingsJSONContentSchema>;
export type UserSettingsJSONContentSchema = Static<typeof userSettingsJSONContentSchema>;

export type CompanyInformationSchema = Static<typeof companyInformationJSONSchema>;
export type GlobalSettingsJSONContentSchema = Static<typeof globalSettingsJSONSchema>;
