import { ALLOWED_AVATAR_IMAGE_TYPES } from "@repo/shared";
import { Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import {
  createGroupSchema,
  groupBaseLanguageUpdateSchema,
  groupLanguageSchema,
  groupSortFieldsOptions,
  updateGroupSchema,
} from "src/group/group.schema";
import {
  updateUserProfileSchema,
  updateUserSchema,
  upsertUserDetailsSchema,
} from "src/user/schemas/updateUser.schema";
import { sortUserFieldsOptions } from "src/user/schemas/userQuery";
import { AVATAR_MAX_SIZE } from "src/user/user.constants";

const objectOptions = { additionalProperties: false };
const pagination = {
  page: Type.Optional(Type.Integer({ minimum: 1 })),
  pageSize: Type.Optional(Type.Integer({ minimum: 1, maximum: 100 })),
};
const userIds = Type.Array(UUIDSchema, { minItems: 1, maxItems: 100, uniqueItems: true });
const groupIds = Type.Array(UUIDSchema, { maxItems: 100, uniqueItems: true });
const groupList = {
  ...pagination,
  query: Type.Optional(Type.String()),
  sort: Type.Optional(groupSortFieldsOptions),
  language: Type.Optional(groupLanguageSchema),
};

export const listUsersInputSchema = Type.Object(
  {
    ...pagination,
    query: Type.Optional(Type.String()),
    roleSlug: Type.Optional(Type.String()),
    archived: Type.Optional(Type.Boolean()),
    groups: Type.Optional(groupIds),
    sort: Type.Optional(sortUserFieldsOptions),
  },
  objectOptions,
);
export const getUserInputSchema = Type.Object(
  {
    userId: UUIDSchema,
    language: Type.Optional(groupLanguageSchema),
  },
  objectOptions,
);
export const emptyAdminInputSchema = Type.Object({}, objectOptions);
export const updateUserInputSchema = Type.Object(
  {
    userId: UUIDSchema,
    ...Type.Omit(updateUserSchema, ["archived", "groups"]).properties,
    groups: Type.Optional(Type.Union([groupIds, Type.Null()])),
  },
  { ...objectOptions, minProperties: 2 },
);
export const updateUsersRolesInputSchema = Type.Object(
  {
    userIds,
    roleSlugs: Type.Array(Type.String({ minLength: 1 }), { minItems: 1, uniqueItems: true }),
  },
  objectOptions,
);
export const assignUsersGroupsInputSchema = Type.Object(
  {
    assignments: Type.Array(Type.Object({ userId: UUIDSchema, groups: groupIds }, objectOptions), {
      minItems: 1,
      maxItems: 100,
    }),
  },
  objectOptions,
);
export const updateMyProfileInputSchema = Type.Object(
  Type.Omit(updateUserProfileSchema, ["userAvatar"]).properties,
  { ...objectOptions, minProperties: 1 },
);
export const updateMyDetailsInputSchema = Type.Object(upsertUserDetailsSchema.properties, {
  ...objectOptions,
  minProperties: 1,
});
export const listGroupsInputSchema = Type.Object(groupList, objectOptions);
export const getGroupInputSchema = Type.Object(
  {
    groupId: UUIDSchema,
    language: Type.Optional(groupLanguageSchema),
  },
  objectOptions,
);
export const listUserGroupsInputSchema = Type.Object(
  { userId: UUIDSchema, ...groupList },
  objectOptions,
);
export const listCourseGroupsInputSchema = Type.Object(
  {
    courseId: UUIDSchema,
    language: Type.Optional(groupLanguageSchema),
  },
  objectOptions,
);
export const createGroupInputSchema = Type.Object(
  {
    ...createGroupSchema.properties,
    idempotencyKey: Type.String({ minLength: 1, maxLength: 200 }),
  },
  objectOptions,
);
export const updateGroupInputSchema = Type.Object(
  {
    groupId: UUIDSchema,
    ...updateGroupSchema.properties,
  },
  { ...objectOptions, minProperties: 2 },
);
export const groupLanguageInputSchema = Type.Object(
  { groupId: UUIDSchema, language: groupLanguageSchema },
  objectOptions,
);
export const removeGroupLanguageInputSchema = Type.Object(
  {
    ...groupLanguageInputSchema.properties,
    confirmLanguage: groupLanguageSchema,
  },
  objectOptions,
);
export const groupBaseLanguageInputSchema = Type.Object(
  {
    groupId: UUIDSchema,
    ...groupBaseLanguageUpdateSchema.properties,
  },
  objectOptions,
);
export const setUserGroupsInputSchema = Type.Object(
  { userId: UUIDSchema, groupIds },
  objectOptions,
);

export const updateMyUserInputSchema = Type.Object(
  Type.Pick(updateUserSchema, ["firstName", "lastName", "email"]).properties,
  { ...objectOptions, minProperties: 1 },
);
export const requestMyAvatarUploadInputSchema = Type.Object(
  {
    filename: Type.String({ minLength: 1, maxLength: 255 }),
    mimeType: Type.Union(ALLOWED_AVATAR_IMAGE_TYPES.map((mime) => Type.Literal(mime))),
    size: Type.Integer({ minimum: 1, maximum: AVATAR_MAX_SIZE }),
  },
  objectOptions,
);
