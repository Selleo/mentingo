import { TENANT_STATUSES, type TenantStatus } from "@repo/shared";
import { boolean, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

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
  },
  (table) => ({
    uniqueHostIdx: uniqueIndex("unique_host_idx").on(table.host),
  }),
);
