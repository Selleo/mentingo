import { Type, type Static } from "@sinclair/typebox";

import { USER_ROLES } from "./userRoles";

export const userSortFields = ["title", "createdAt", "role"] as const;

export const UserSortFields: Record<UserSortField, UserSortField> = {
  title: "title",
  createdAt: "createdAt",
  role: "role",
};

export type UserSortField = (typeof userSortFields)[number];

export const sortUserFieldsOptions = Type.Union([
  Type.Literal("title"),
  Type.Literal("createdAt"),
  Type.Literal("role"),
  Type.Literal("-title"),
  Type.Literal("-createdAt"),
  Type.Literal("-role"),
]);

export type SortUserFieldsOptions = Static<typeof sortUserFieldsOptions>;

export const usersFilterSchema = Type.Object({
  keyword: Type.Optional(Type.String()),
  archived: Type.Optional(Type.Boolean()),
  role: Type.Optional(Type.Enum(USER_ROLES)),
  groupId: Type.Optional(Type.String()),
});

export type UsersFilterSchema = Static<typeof usersFilterSchema>;

export type UsersQuery = {
  filters?: UsersFilterSchema;
  page?: number;
  perPage?: number;
  sort?: SortUserFieldsOptions;
};
