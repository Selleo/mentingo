import { inArray, sql } from "drizzle-orm";

import type { SQL } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { UUIDType } from "src/common";

export const getRestrictedIdsCondition = (
  restricted: boolean,
  ids: UUIDType[],
  source: AnyPgColumn,
): SQL | undefined => {
  if (!restricted) return undefined;
  if (!ids.length) return sql`FALSE`;
  return inArray(source, ids);
};

export const getRestrictedIdsSqlFragment = (
  restricted: boolean,
  ids: UUIDType[],
  source: SQL,
): SQL => {
  if (!restricted) return sql``;
  if (!ids.length) return sql`AND FALSE`;
  return sql`AND ${source} IN ${ids}`;
};
