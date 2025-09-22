import { type Static, Type } from "@sinclair/typebox";

import { UUIDSchema } from "src/common";
import { commonUserSchema } from "src/common/schemas/common-user.schema";
import { USER_ROLES } from "src/user/schemas/userRoles";

export const baseUserResponseSchema = Type.Composite([
  Type.Omit(commonUserSchema, ["avatarReference"]),
  Type.Object({
    profilePictureUrl: Type.Union([Type.String(), Type.Null()]),
  }),
]);

export const currentUserResponseSchema = Type.Composite([
  baseUserResponseSchema,
  Type.Object({
    shouldVerifyMFA: Type.Boolean(),
  }),
]);

export const allUsersSchema = Type.Array(
  Type.Intersect([
    baseUserResponseSchema,
    Type.Object({
      groupId: Type.Union([UUIDSchema, Type.Null()]),
      groupName: Type.Union([Type.String(), Type.Null()]),
    }),
  ]),
);

export const userSchema = Type.Composite([
  Type.Omit(commonUserSchema, ["avatarReference"]),
  Type.Object({
    profilePictureUrl: Type.Union([Type.String(), Type.Null()]),
    groupId: Type.Union([UUIDSchema, Type.Null()]),
    groupName: Type.Union([Type.String(), Type.Null()]),
  }),
]);

export const userDetailsSchema = Type.Object({
  firstName: Type.Union([Type.String(), Type.Null()]),
  lastName: Type.Union([Type.String(), Type.Null()]),
  id: Type.String({ format: "uuid" }),
  description: Type.Union([Type.String(), Type.Null()]),
  contactEmail: Type.Union([Type.String(), Type.Null()]),
  contactPhone: Type.Union([Type.String(), Type.Null()]),
  jobTitle: Type.Union([Type.String(), Type.Null()]),
  role: Type.Enum(USER_ROLES),
});

export const userDetailsResponseSchema = Type.Object({
  ...userDetailsSchema.properties,
  profilePictureUrl: Type.Union([Type.String(), Type.Null()]),
});

export type UserDetailsWithAvatarKey = Static<typeof userDetailsSchema> & {
  avatarReference: string | null;
};

export type UserDetailsResponse = Static<typeof userDetailsResponseSchema>;
export type UserResponseBody = Static<typeof userSchema>;
export type UserResponse = Static<typeof baseUserResponseSchema>;
export type AllUsersResponse = Static<typeof allUsersSchema>;
