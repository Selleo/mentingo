import { sql } from "drizzle-orm";

import { settings } from "src/storage/schema";

import type { DiscussionNotificationPreference } from "@repo/shared";

export const isNotificationPreferenceEnabled = (preference: DiscussionNotificationPreference) =>
  sql<boolean>`COALESCE((${settings.settings}->>${preference})::boolean, true)`;
