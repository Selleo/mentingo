import { sql } from "drizzle-orm";

import type { AnyPgColumn } from "drizzle-orm/pg-core";

export function setJsonbField(
  field: any,
  key?: string | null,
  value?: string | null,
  createMissing: boolean = true,
) {
  if (!(key && value)) {
    return undefined;
  }

  return sql`
    jsonb_set(
      COALESCE(${field}, '{}'::jsonb),
    ARRAY[${key}]::text[],
    to_jsonb(${value}::text),
    ${createMissing}
    )
  `;
}

export function buildJsonbField(key?: string | null, value?: string | null) {
  if (!(key && value)) {
    return undefined;
  }

  return sql`json_build_object(${key}::text, ${value}::text)`;
}

export function deleteJsonbField(field: AnyPgColumn, key: string) {
  return sql`${field} - ${key}::text`;
}

export function buildJsonbFieldWithMultipleEntries(entries: Partial<Record<string, string>>) {
  const keys = Object.keys(entries);

  if (!keys.length) return sql`'{}'::jsonb`;

  const pairs = keys.flatMap((key) => [sql`${key}::text`, sql`${entries[key]}::text`]);

  return sql`jsonb_build_object(${sql.join(pairs, sql`, `)})`;
}
