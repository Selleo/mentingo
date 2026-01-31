import { Type } from "@sinclair/typebox";
import { createSelectSchema } from "drizzle-typebox";

import { users } from "src/storage/schema";
import { omitTenantId } from "src/utils/omitTenantId";

import type { Static } from "@sinclair/typebox";

const userSchema = omitTenantId(createSelectSchema(users));

export const commonUserSchema = Type.Composite([userSchema]);

export type CommonUser = Static<typeof commonUserSchema>;
