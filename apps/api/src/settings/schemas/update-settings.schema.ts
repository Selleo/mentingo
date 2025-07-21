import { Type } from "@sinclair/typebox";

import {
  adminSettingsJSONContentSchema,
  studentSettingsJSONContentSchema,
} from "./settings.schema";

import type { Static } from "@sinclair/typebox";

export const updateSettingsBodySchema = Type.Partial(
  Type.Union([studentSettingsJSONContentSchema, adminSettingsJSONContentSchema]),
);

export type UpdateSettingsBody = Static<typeof updateSettingsBodySchema>;
