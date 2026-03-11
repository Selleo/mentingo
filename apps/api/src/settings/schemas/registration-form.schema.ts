import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import type { Static } from "@sinclair/typebox";

export const registrationFormFieldTypeSchema = Type.Union([Type.Literal("checkbox")]);

export const localizedLabelSchema = Type.Partial(
  Type.Record(Type.Enum(SUPPORTED_LANGUAGES), Type.String({ minLength: 1 })),
  { minProperties: 1 },
);

export const registrationFormFieldSchema = Type.Object({
  id: UUIDSchema,
  type: registrationFormFieldTypeSchema,
  label: localizedLabelSchema,
  baseLanguage: Type.Enum(SUPPORTED_LANGUAGES),
  availableLocales: Type.Array(Type.Enum(SUPPORTED_LANGUAGES)),
  required: Type.Boolean(),
  displayOrder: Type.Number(),
  archived: Type.Boolean(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const localizedRegistrationFormFieldSchema = Type.Object({
  id: UUIDSchema,
  type: registrationFormFieldTypeSchema,
  label: Type.String({ minLength: 1 }),
  baseLanguage: Type.Enum(SUPPORTED_LANGUAGES),
  availableLocales: Type.Array(Type.Enum(SUPPORTED_LANGUAGES)),
  required: Type.Boolean(),
  displayOrder: Type.Number(),
  archived: Type.Boolean(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
});

export const registrationFormResponseSchema = Type.Object({
  fields: Type.Array(registrationFormFieldSchema),
});

export const localizedRegistrationFormResponseSchema = Type.Object({
  fields: Type.Array(localizedRegistrationFormFieldSchema),
});

export const upsertRegistrationFormFieldSchema = Type.Object({
  id: Type.Optional(UUIDSchema),
  type: registrationFormFieldTypeSchema,
  label: localizedLabelSchema,
  baseLanguage: Type.Optional(Type.Enum(SUPPORTED_LANGUAGES)),
  availableLocales: Type.Optional(Type.Array(Type.Enum(SUPPORTED_LANGUAGES))),
  required: Type.Boolean(),
  displayOrder: Type.Number(),
  archived: Type.Boolean(),
});

export const updateRegistrationFormSchema = Type.Object({
  fields: Type.Array(upsertRegistrationFormFieldSchema),
});

export const registrationAnswerSchema = Type.Object({
  fieldId: UUIDSchema,
  value: Type.Boolean(),
  labelSnapshot: localizedLabelSchema,
  answeredLanguage: Type.Enum(SUPPORTED_LANGUAGES),
});

export type RegistrationFormField = Static<typeof registrationFormFieldSchema>;
export type RegistrationFormResponse = Static<typeof registrationFormResponseSchema>;
export type LocalizedRegistrationFormField = Static<typeof localizedRegistrationFormFieldSchema>;
export type LocalizedRegistrationFormResponse = Static<
  typeof localizedRegistrationFormResponseSchema
>;
export type UpsertRegistrationFormField = Static<typeof upsertRegistrationFormFieldSchema>;
export type UpdateRegistrationFormBody = Static<typeof updateRegistrationFormSchema>;
export type RegistrationAnswer = Static<typeof registrationAnswerSchema>;
export type LocalizedLabel = Static<typeof localizedLabelSchema>;
