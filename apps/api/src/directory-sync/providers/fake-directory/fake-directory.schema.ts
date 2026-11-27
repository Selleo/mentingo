import { type Static, Type } from "@sinclair/typebox";

export const fakeDirectoryWorkspaceSchema = Type.Object({
  customerId: Type.String({ minLength: 1 }),
  users: Type.Array(
    Type.Object({
      id: Type.String({ minLength: 1 }),
      email: Type.String({ minLength: 1 }),
      firstName: Type.String(),
      lastName: Type.String(),
      orgUnitPath: Type.String({ minLength: 1 }),
      suspended: Type.Optional(Type.Boolean()),
      isAdmin: Type.Optional(Type.Boolean()),
    }),
  ),
  orgUnits: Type.Array(
    Type.Object({
      id: Type.String({ minLength: 1 }),
      path: Type.String({ minLength: 1 }),
      name: Type.String({ minLength: 1 }),
    }),
  ),
  groups: Type.Array(
    Type.Object({
      id: Type.String({ minLength: 1 }),
      email: Type.String({ minLength: 1 }),
      name: Type.String({ minLength: 1 }),
      memberUserIds: Type.Array(Type.String()),
      memberGroupIds: Type.Optional(Type.Array(Type.String())),
    }),
  ),
});

export type FakeDirectoryWorkspace = Static<typeof fakeDirectoryWorkspaceSchema>;
