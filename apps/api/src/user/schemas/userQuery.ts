import { Type, type Static } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";

import { USER_ROLES } from "./userRoles";

export const userSortFields = ["firstName", "lastName", "email", "createdAt", "groupName"] as const;

export const UserSortFields: Record<UserSortField, UserSortField> = {
  firstName: "firstName",
  lastName: "lastName",
  email: "email",
  createdAt: "createdAt",
  groupName: "groupName",
};

export type UserSortField = (typeof userSortFields)[number];

export const sortUserFieldsOptions = Type.Union([
  ...userSortFields.map((field) => Type.Literal(field)),
  ...userSortFields.map((field) => Type.Literal(`-${field}`)),
]);

export type SortUserFieldsOptions = Static<typeof sortUserFieldsOptions>;

export const usersFilterSchema = Type.Object({
  keyword: Type.Optional(Type.String()),
  archived: Type.Optional(Type.Boolean()),
  role: Type.Optional(Type.Enum(USER_ROLES)),
  groupId: Type.Optional(UUIDSchema),
});

export type UsersFilterSchema = Static<typeof usersFilterSchema>;

export type UsersQuery = {
  filters?: UsersFilterSchema;
  page?: number;
  perPage?: number;
  sort?: SortUserFieldsOptions;
};
