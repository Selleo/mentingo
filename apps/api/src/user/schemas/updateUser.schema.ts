import { type Static, Type } from "@sinclair/typebox";

import { USER_ROLES } from "./userRoles";

export const updateUserSchema = Type.Object({
  firstName: Type.Optional(Type.String()),
  lastName: Type.Optional(Type.String()),
  email: Type.Optional(Type.String({ format: "email" })),
  role: Type.Optional(Type.Enum(USER_ROLES)),
  archived: Type.Optional(Type.Boolean()),
});
export const upsertUserDetailsSchema = Type.Object({
  description: Type.Optional(Type.String()),
  contactEmail: Type.Optional(Type.String({ format: "email" })),
  contactPhoneNumber: Type.Optional(Type.String()),
  jobTitle: Type.Optional(Type.String()),
});

export const updateFullUserSchema = Type.Object({
  firstName: Type.Optional(Type.String()),
  lastName: Type.Optional(Type.String()),
  description: Type.Optional(Type.String()),
  contactEmail: Type.Optional(Type.String({ format: "email" })),
  contactPhoneNumber: Type.Optional(Type.String()),
  jobTitle: Type.Optional(Type.String()),
});

export type UpdateFullUserBody = Static<typeof updateFullUserSchema>;
export type UpsertUserDetailsBody = Static<typeof upsertUserDetailsSchema>;
export type UpdateUserBody = Static<typeof updateUserSchema>;
