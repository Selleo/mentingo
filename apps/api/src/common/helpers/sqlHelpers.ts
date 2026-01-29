import { sql } from "drizzle-orm";

import type { AnyPgColumn } from "drizzle-orm/pg-core";

export function setJsonbField(
  field: any,
  key?: string | null,
  value?: string | null,
  createMissing: boolean = true,
  allowEmpty: boolean = false,
) {
  if (key == null || value === undefined) return undefined;
  if (!allowEmpty && !(key && value)) return undefined;
  if (allowEmpty && value === null) return sql`null`;

  return sql`
    jsonb_set(
      COALESCE(${field}, '{}'::jsonb),
      ARRAY[${key}]::text[],
      to_jsonb(${value}::text),
      ${createMissing}
    )
  `;
}

export function buildJsonbField(
  key?: string | null,
  value?: string | null,
  allowEmpty: boolean = false,
) {
  if (key == null || value === undefined) return undefined;
  if (!allowEmpty && !(key && value)) return undefined;
  if (allowEmpty && value === null) return sql`null`;

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

/**
 * Builds a SQL IN clause for the given array of string values.
 * Example output: ('value1', 'value2', 'value3')
 * @param values - An array of string values to include in the IN clause.
 * @returns A SQL fragment representing the IN clause.
 */
export const buildSqlInClause = (values: string[]) =>
  sql`(${sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  )})`;
