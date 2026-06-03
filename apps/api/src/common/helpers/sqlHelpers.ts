import { sql, type SQL } from "drizzle-orm";

import type { AnyPgColumn } from "drizzle-orm/pg-core";

type SqlExpression<T = unknown> = SQL<T> | AnyPgColumn;

export function setJsonbField(
  field: any,
  key?: string | null,
  value?: string | boolean | number | null,
  createMissing: boolean = true,
  allowEmpty: boolean = false,
) {
  if (key == null || value === undefined) return undefined;
  if (!allowEmpty && !key) return undefined;
  if (!allowEmpty && (value === null || (typeof value === "string" && !value))) return undefined;
  if (allowEmpty && value === null) return sql`null`;

  const objectField = sql`
    CASE
      WHEN jsonb_typeof(${field}) = 'object' THEN ${field}
      ELSE '{}'::jsonb
    END
  `;
  let jsonValue = sql`to_jsonb(${value}::text)`;

  if (typeof value === "boolean") {
    jsonValue = sql`to_jsonb(${value}::boolean)`;
  }

  if (typeof value === "number") {
    jsonValue = sql`to_jsonb(${value}::numeric)`;
  }

  return sql`
    jsonb_set(
      ${objectField},
      ARRAY[${key}]::text[],
      ${jsonValue},
      ${createMissing}
    )
  `;
}

export type JsonbFieldUpdate = ReturnType<typeof setJsonbField>;

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

export function mergeJsonbField(existingField: SqlExpression, incomingField: SqlExpression) {
  return sql`
    CASE
      WHEN ${incomingField} IS NULL THEN ${existingField}
      WHEN jsonb_typeof(${existingField}) = 'object' THEN ${existingField} || ${incomingField}
      ELSE '{}'::jsonb || ${incomingField}
    END
  `;
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
