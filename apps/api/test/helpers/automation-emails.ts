import { and, asc, eq } from "drizzle-orm";

import { AutomationEmailDeliveryService } from "src/automation-execution/services/automation-email-delivery.service";
import { DB } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { automationEmailDeliveries } from "src/storage/schema";

import type { INestApplication } from "@nestjs/common";
import type { DatabasePg } from "src/common";

/** Run committed deliveries deterministically in specs that disable the email worker. */
export async function deliverPendingAutomationEmails(
  app: INestApplication,
  tenantId: string,
  allowFailures = false,
) {
  return app.get(TenantDbRunnerService).runWithTenant(tenantId, async () => {
    const deliveries = await app
      .get<DatabasePg>(DB)
      .select({ id: automationEmailDeliveries.id })
      .from(automationEmailDeliveries)
      .where(
        and(
          eq(automationEmailDeliveries.tenantId, tenantId),
          eq(automationEmailDeliveries.status, "pending"),
        ),
      )
      .orderBy(asc(automationEmailDeliveries.stepOrder));

    const results = await Promise.allSettled(
      deliveries.map(({ id }) =>
        app.get(AutomationEmailDeliveryService).sendAutomationEmail(id, tenantId),
      ),
    );

    if (!allowFailures) {
      for (const result of results) {
        if (result.status === "rejected") throw result.reason;
      }
    }
    return results;
  });
}
