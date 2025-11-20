import { sql } from "drizzle-orm";

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
      ${field},
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
