import { sql, type SQLWrapper } from "drizzle-orm";

export function getFirstJsonbValueSql(field: SQLWrapper) {
  return sql<string>`(
    SELECT value
    FROM jsonb_each_text(
      CASE
        WHEN jsonb_typeof(${field}) = 'object' THEN ${field}
        ELSE '{}'::jsonb
      END
    )
    LIMIT 1
  )`;
}

/** Reads both current localized objects and legacy scalar JSONB values. */
export function getLocalizedJsonbValueSql(field: SQLWrapper, language: SQLWrapper) {
  const firstValue = getFirstJsonbValueSql(field);

  return sql<string>`CASE
    WHEN jsonb_typeof(${field}) = 'object' THEN COALESCE(
      NULLIF(${field} ->> ${language}, ''),
      ${firstValue},
      ''
    )
    WHEN jsonb_typeof(${field}) = 'string' THEN ${field} #>> '{}'
    ELSE ''
  END`;
}
