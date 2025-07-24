import { type Static, Type } from "@sinclair/typebox";

import { commonUserSchema } from "src/common/schemas/common-user.schema";
import { USER_ROLES } from "src/user/schemas/userRoles";

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

export const baseUserResponseSchema = Type.Omit(commonUserSchema, ["avatarReference"]);

export const userDetailsResponseSchema = Type.Object({
  ...userDetailsSchema.properties,
  profilePictureUrl: Type.Union([Type.String(), Type.Null()]),
});

export const allUsersSchema = Type.Array(baseUserResponseSchema);

export type UserDetailsWithAvatarKey = Static<typeof userDetailsSchema> & {
  avatarReference: string | null;
};
export type UserDetailsResponse = Static<typeof userDetailsResponseSchema>;
export type UserResponse = Static<typeof baseUserResponseSchema>;
export type AllUsersResponse = Static<typeof allUsersSchema>;
