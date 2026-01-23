import { sql } from "drizzle-orm";
import { boolean, text, timestamp, uuid } from "drizzle-orm/pg-core";

import { tenants } from ".";

export const id = {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
};

export const timestamps = {
  createdAt: timestamp("created_at", {
    mode: "string",
    withTimezone: true,
    precision: 3,
  })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),

  updatedAt: timestamp("updated_at", {
    mode: "string",
    withTimezone: true,
    precision: 3,
  })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
};

export const archived = boolean("archived").default(false).notNull();

export const STATUS = {
  draft: { key: "draft", value: "Draft" },
  published: { key: "published", value: "Published" },
  archived: { key: "archived", value: "Archived" },
} as const;

export const STATUS_KEYS = Object.fromEntries(
  Object.entries(STATUS).map(([key, { value }]) => [key, value]),
);

export const baseLanguage = text("base_language").notNull().default("en");
export const availableLocales = text("available_locales")
  .array()
  .notNull()
  .default(sql`ARRAY['en']::text[]`);

export const tenantId = uuid("tenant_id")
  .references(() => tenants.id, { onDelete: "cascade" })
  .notNull()
  .default(sql`current_setting('app.tenant_id', true)::uuid`);
