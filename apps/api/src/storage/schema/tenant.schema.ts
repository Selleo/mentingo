import {
  TENANT_STATUSES,
  TENANT_USER_CAPACITY_ALERT_LEVELS,
  type TenantStatus,
  type TenantUserCapacityAlertLevel,
} from "@repo/shared";
import { boolean, integer, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { id, timestampWithTimezone, timestamps } from "./columns";

export const tenants = pgTable(
  "tenants",
  {
    ...id,
    ...timestamps,
    name: text("name").notNull(),
    host: text("host").notNull(),
    status: text("status").notNull().$type<TenantStatus>().default(TENANT_STATUSES.ACTIVE),
    isManaging: boolean("is_managing").notNull().default(false),
    accessEndsAt: timestampWithTimezone({ name: "access_ends_at" }),
    maxUsers: integer("max_users"),
    maxUsersOverflowPercentage: integer("max_users_overflow_percentage").notNull().default(0),
    userCapacityAlertLevel: text("user_capacity_alert_level")
      .notNull()
      .$type<TenantUserCapacityAlertLevel>()
      .default(TENANT_USER_CAPACITY_ALERT_LEVELS.WITHIN_LIMIT),
  },
  (table) => ({
    uniqueHostIdx: uniqueIndex("unique_host_idx").on(table.host),
  }),
);
