import { Type } from "@sinclair/typebox";
import { createSelectSchema } from "drizzle-typebox";

import { settingsSchema } from "src/settings/schemas/settings.schema";
import { users } from "src/storage/schema";

import type { Static } from "@sinclair/typebox";

const userSchema = createSelectSchema(users);

export const commonUserSchema = Type.Composite([userSchema]);

export type CommonUser = Static<typeof commonUserSchema>;
