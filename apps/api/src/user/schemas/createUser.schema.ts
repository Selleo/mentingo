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

export const importUserResponseSchema = Type.Object({
  importedUsersAmount: Type.Number(),
  skippedUsersAmount: Type.Number(),
});

export type ImportUser = Static<typeof importUserSchema>;
