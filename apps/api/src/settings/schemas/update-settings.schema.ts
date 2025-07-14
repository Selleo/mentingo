import { Type } from "@sinclair/typebox";

import { settingsJSONContentSchema } from "./settings.schema";

import type { Static } from "@sinclair/typebox";

export const updateSettingsBodySchema = Type.Partial(settingsJSONContentSchema);

export type UpdateSettingsBody = Static<typeof updateSettingsBodySchema>;
