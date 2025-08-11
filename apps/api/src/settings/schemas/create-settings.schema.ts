import { settingsJSONContentSchema } from "./settings.schema";

import type { Static } from "@sinclair/typebox";

export const createSettingsBodySchema = settingsJSONContentSchema;

export type CreateSettingsBody = Static<typeof createSettingsBodySchema>;
