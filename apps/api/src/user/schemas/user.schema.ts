import { PERMISSIONS } from "@repo/shared";
import { type Static, Type } from "@sinclair/typebox";
import { createSelectSchema } from "drizzle-typebox";

import { UUIDSchema } from "src/common";
import { commonUserSchema } from "src/common/schemas/common-user.schema";
import { userOnboarding } from "src/storage/schema";
import { omitTenantId } from "src/utils/omitTenantId";

export const baseUserResponseSchema = Type.Composite([
  Type.Omit(commonUserSchema, ["avatarReference"]),
  Type.Object({
    profilePictureUrl: Type.Union([Type.String(), Type.Null()]),
  }),
]);

export const userOnboardingStatusSchema = omitTenantId(createSelectSchema(userOnboarding));

export const currentUserResponseSchema = Type.Composite([
  baseUserResponseSchema,
  Type.Object({
    roleSlugs: Type.Array(Type.String()),
    permissions: Type.Array(
      Type.Union(Object.values(PERMISSIONS).map((permission) => Type.Literal(permission))),
    ),
    shouldVerifyMFA: Type.Boolean(),
    onboardingStatus: userOnboardingStatusSchema,
    isManagingTenantAdmin: Type.Boolean(),
    isSupportMode: Type.Boolean(),
    studentModeCourseIds: Type.Array(UUIDSchema),
    supportContext: Type.Optional(
      Type.Object({
        originalUserId: UUIDSchema,
        originalTenantId: UUIDSchema,
        targetTenantId: UUIDSchema,
        expiresAt: Type.String(),
        returnUrl: Type.String(),
      }),
    ),
  }),
]);

export const allUsersSchema = Type.Array(
  Type.Intersect([
    baseUserResponseSchema,
    Type.Object({
      groups: Type.Array(
        Type.Object({
          id: UUIDSchema,
          name: Type.String(),
        }),
      ),
    }),
  ]),
);

export const userSchema = Type.Composite([
  Type.Omit(commonUserSchema, ["avatarReference"]),
  Type.Object({
    profilePictureUrl: Type.Union([Type.String(), Type.Null()]),
    roleSlugs: Type.Array(Type.String()),
    groups: Type.Array(
      Type.Object({
        id: UUIDSchema,
        name: Type.String(),
      }),
    ),
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
});

export const userDetailsResponseSchema = Type.Object({
  ...userDetailsSchema.properties,
  profilePictureUrl: Type.Union([Type.String(), Type.Null()]),
});

export type UserDetailsWithAvatarKey = Static<typeof userDetailsSchema> & {
  avatarReference: string | null;
};

export type UserDetailsResponse = Static<typeof userDetailsResponseSchema>;
export type UserResponse = Static<typeof userSchema>;
export type AllUsersResponse = Static<typeof allUsersSchema>;
