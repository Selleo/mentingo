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

export const userWithoutProfilePictureKeySchema = Type.Omit(commonUserSchema, [
  "profilePictureS3Key",
]);

export const userWithProfilePictureUrlSchema = Type.Object({
  firstName: Type.Union([Type.String(), Type.Null()]),
  lastName: Type.Union([Type.String(), Type.Null()]),
  id: Type.String({ format: "uuid" }),
  description: Type.Union([Type.String(), Type.Null()]),
  contactEmail: Type.Union([Type.String(), Type.Null()]),
  contactPhone: Type.Union([Type.String(), Type.Null()]),
  jobTitle: Type.Union([Type.String(), Type.Null()]),
  role: Type.Enum(USER_ROLES),
  profilePictureUrl: Type.Union([Type.String(), Type.Null()]),
});

export const allUsersSchema = Type.Array(userWithoutProfilePictureKeySchema);

export type UserDetails = Static<typeof userDetailsSchema>;
export type UserDetailsWithProfilePictureKey = Static<typeof userDetailsSchema> & {
  profilePictureS3Key: string | null;
};
export type UserDetailsWithProfilePictureUrl = Static<typeof userWithProfilePictureUrlSchema>;
export type UserResponse = Static<typeof userWithoutProfilePictureKeySchema>;
export type AllUsersResponse = Static<typeof allUsersSchema>;
