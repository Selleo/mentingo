import { type Static, Type } from "@sinclair/typebox";

import { USER_ROLES } from "./userRoles";

export const createUserSchema = Type.Object({
  email: Type.String({ format: "email" }),
  firstName: Type.String({ minLength: 1, maxLength: 64 }),
  lastName: Type.String({ minLength: 1, maxLength: 64 }),
  role: Type.Enum(USER_ROLES),
});

export type CreateUserBody = Static<typeof createUserSchema>;

export const importUserSchema = Type.Object({
  email: Type.String({ format: "email" }),
  firstName: Type.String(),
  lastName: Type.String(),
  role: Type.Enum(USER_ROLES),
  groupName: Type.Optional(Type.String()),
});

export const skippedUserImportSchema = Type.Object({
  email: Type.String({ format: "email" }),
  reason: Type.String(),
});

export const importUserResponseSchema = Type.Object({
  importedUsersAmount: Type.Number(),
  skippedUsersAmount: Type.Number(),
  importedUsersList: Type.Array(Type.String({ format: "email" })),
  skippedUsersList: Type.Array(skippedUserImportSchema),
});

export type ImportUser = Static<typeof importUserSchema>;
export type SkippedUserImport = Static<typeof skippedUserImportSchema>;
export type ImportUserResponse = Static<typeof importUserResponseSchema>;
