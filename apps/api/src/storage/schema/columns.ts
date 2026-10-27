import { sql } from "drizzle-orm";
import { timestamp, uuid } from "drizzle-orm/pg-core";

export const id = {
  id: uuid("id")
    .default(sql`gen_random_uuid()`)
    .primaryKey(),
};

export const timestampWithTimezone = <TName extends string>({ name }: { name: TName }) =>
  timestamp(name, {
    mode: "string",
    withTimezone: true,
    precision: 3,
  });

export const timestamps = {
  createdAt: timestampWithTimezone({ name: "created_at" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),

  updatedAt: timestampWithTimezone({ name: "updated_at" })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull()
    .$onUpdate(() => sql`CURRENT_TIMESTAMP`),
};
