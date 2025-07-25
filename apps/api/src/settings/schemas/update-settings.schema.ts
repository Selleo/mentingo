import { Type } from "@sinclair/typebox";

import {
  adminSettingsJSONContentSchema,
  globalSettingsJSONContentSchema,
  studentSettingsJSONContentSchema,
} from "./settings.schema";

import type { Static } from "@sinclair/typebox";

export const updateSettingsBodySchema = Type.Partial(
  Type.Union([studentSettingsJSONContentSchema, adminSettingsJSONContentSchema]),
);

export const updateGlobalSettingsBodySchema = Type.Partial(globalSettingsJSONContentSchema);

export type UpdateSettingsBody = Static<typeof updateSettingsBodySchema>;
export type UpdateGlobalSettingsBody = Static<typeof updateGlobalSettingsBodySchema>;
