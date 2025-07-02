import { type Static, Type } from "@sinclair/typebox";

import { commonUserSchema } from "src/common/schemas/common-user.schema";

export const allUsersSchema = Type.Array(commonUserSchema);
export const userDetailsSchema = Type.Object({
  firstName: Type.Union([Type.String(), Type.Null()]),
  lastName: Type.Union([Type.String(), Type.Null()]),
  id: Type.String({ format: "uuid" }),
  description: Type.Union([Type.String(), Type.Null()]),
  contactEmail: Type.Union([Type.String(), Type.Null()]),
  contactPhone: Type.Union([Type.String(), Type.Null()]),
  jobTitle: Type.Union([Type.String(), Type.Null()]),
  role: Type.Union([Type.String(), Type.Null()]),
});

export type UserDetails = Static<typeof userDetailsSchema>;
export type UserResponse = Static<typeof commonUserSchema>;
export type AllUsersResponse = Static<typeof allUsersSchema>;
