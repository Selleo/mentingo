import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import { USER_ROLES } from "./userRoles";

export const updateUserSchema = Type.Object({
  firstName: Type.Optional(Type.String()),
  lastName: Type.Optional(Type.String()),
  groups: Type.Optional(Type.Union([Type.Array(Type.String()), Type.Null()])),
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

export const updateUserProfileSchema = Type.Object({
  firstName: Type.Optional(Type.String()),
  lastName: Type.Optional(Type.String()),
  userAvatar: Type.Optional(Type.Union([Type.String(), Type.Null()])),
  description: Type.Optional(Type.String()),
  contactEmail: Type.Optional(Type.String({ format: "email" })),
  contactPhone: Type.Optional(Type.String()),
  jobTitle: Type.Optional(Type.String()),
});

export const bulkAssignUsersGroupsSchema = Type.Array(
  Type.Object({
    userId: UUIDSchema,
    groups: Type.Array(UUIDSchema),
  }),
);

export type BulkAssignUserGroups = Static<typeof bulkAssignUsersGroupsSchema>;
export type UpdateUserProfileBody = Static<typeof updateUserProfileSchema>;
export type UpsertUserDetailsBody = Static<typeof upsertUserDetailsSchema>;
export type UpdateUserBody = Static<typeof updateUserSchema>;
