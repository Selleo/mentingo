import { sql } from "drizzle-orm";

import type { DatabasePg } from "src/common";

/** Acquire before live-definition row locks in every lifecycle/claim transaction. */
export async function acquireAutomationLifecycleLock(transaction: DatabasePg): Promise<void> {
  await transaction.execute(sql`
    SELECT pg_advisory_xact_lock(hashtextextended(
      'notification-automations:' || current_setting('app.tenant_id', true), 0
    ))
  `);
}
