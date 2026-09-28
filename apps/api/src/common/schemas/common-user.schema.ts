import { Type } from "@sinclair/typebox";
import { createSelectSchema } from "drizzle-typebox";

import { users } from "src/storage/schema";
import { omitTenantId } from "src/utils/omitTenantId";

import type { Static } from "@sinclair/typebox";

const userSchema = omitTenantId(createSelectSchema(users));

/**
 * Phone fields are personal data: they are left out of the shared user shape and exposed only
 * by endpoints that need them (current user, admin user details).
 */
export const commonUserSchema = Type.Composite([
  Type.Omit(userSchema, ["phone", "phoneVerifiedAt"]),
]);

export const userPhoneFieldsSchema = Type.Object({
  phone: Type.Union([Type.String(), Type.Null()]),
  phoneVerifiedAt: Type.Union([Type.String(), Type.Null()]),
});

export type CommonUser = Static<typeof commonUserSchema>;
