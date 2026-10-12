import { sql } from "drizzle-orm";

import type { ReportDefinition } from "../schemas/reports.schema";
import type { SQL } from "drizzle-orm";

/** Cast through text so postgres-js does not JSON-encode Drizzle's serialized value twice. */
export function serializeReportQuery(query: ReportDefinition): SQL {
  return sql`${JSON.stringify(query)}::text::jsonb`;
}
