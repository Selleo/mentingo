import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { baseUserResponseSchema } from "src/user/schemas/user.schema";

export const groupSchema = Type.Object({
  id: UUIDSchema,
  name: Type.String(),
  characteristic: Type.Union([Type.String(), Type.Null()]),
  users: Type.Optional(Type.Array(baseUserResponseSchema)),
  createdAt: Type.Optional(Type.String()),
  updatedAt: Type.Optional(Type.String()),
});
export const allGroupsSchema = Type.Array(groupSchema);
export const baseGroupSchema = Type.Object({
  name: Type.String(),
  characteristic: Type.Optional(Type.String()),
});
export const bulkDeleteGroupsSchema = Type.Array(UUIDSchema);

export const groupsFilterSchema = Type.Object({
  keyword: Type.Optional(Type.String()),
});

export const groupSortFields = ["name", "createdAt"] as const;
export const groupSortFieldsOptions = Type.Union([Type.Literal("name"), Type.Literal("createdAt")]);
export type GroupSortField = (typeof groupSortFields)[number];
export const GroupSortFields: Record<GroupSortField, GroupSortField> = {
  name: "name",
  createdAt: "createdAt",
};
