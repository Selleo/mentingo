import { Inject, Injectable } from "@nestjs/common";
import { and, asc, desc, eq, gt, lt } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { automationEmailDeliveries, automationRuns, emailTemplates } from "src/storage/schema";

import { AUTOMATION_EMAIL_DELIVERY_DIRECTIONS } from "../automation-execution.constants";

import type {
  AutomationEmailDeliveryDirection,
  UpdateAutomationEmailDelivery,
} from "../automation-execution.types";
import type { AutomationRunStatus } from "@repo/shared";

@Injectable()
export class AutomationEmailDeliveryRepository {
  constructor(@Inject(DB) private readonly database: DatabasePg) {}

  async findAdjacentRecipientAutomationEmailDelivery(
    delivery: typeof automationEmailDeliveries.$inferSelect,
    direction: AutomationEmailDeliveryDirection,
    transaction: DatabasePg,
  ) {
    const [adjacent] = await transaction
      .select()
      .from(automationEmailDeliveries)
      .where(
        and(
          eq(automationEmailDeliveries.runId, delivery.runId),
          eq(automationEmailDeliveries.recipientItemId, delivery.recipientItemId),
          direction === AUTOMATION_EMAIL_DELIVERY_DIRECTIONS.PREVIOUS
            ? lt(automationEmailDeliveries.stepOrder, delivery.stepOrder)
            : gt(automationEmailDeliveries.stepOrder, delivery.stepOrder),
        ),
      )
      .orderBy(
        direction === AUTOMATION_EMAIL_DELIVERY_DIRECTIONS.PREVIOUS
          ? desc(automationEmailDeliveries.stepOrder)
          : asc(automationEmailDeliveries.stepOrder),
      )
      .limit(1);

    return adjacent;
  }

  async findAutomationEmailDeliveryById(
    emailDeliveryId: UUIDType,
    transaction: DatabasePg = this.database,
    lock = false,
  ) {
    const query = transaction
      .select()
      .from(automationEmailDeliveries)
      .where(eq(automationEmailDeliveries.id, emailDeliveryId));

    const [delivery] = await (lock ? query.for("update") : query);

    return delivery;
  }

  async findAutomationRunById(runId: UUIDType, transaction: DatabasePg) {
    const [run] = await transaction
      .select()
      .from(automationRuns)
      .where(eq(automationRuns.id, runId));

    return run;
  }

  async findRecipientAutomationEmailDeliveryByStepAndRecipient(
    runId: UUIDType,
    stepId: UUIDType,
    recipientItemId: string,
    transaction: DatabasePg,
  ) {
    const [delivery] = await transaction
      .select({ id: automationEmailDeliveries.id, status: automationEmailDeliveries.status })
      .from(automationEmailDeliveries)
      .where(
        and(
          eq(automationEmailDeliveries.runId, runId),
          eq(automationEmailDeliveries.stepId, stepId),
          eq(automationEmailDeliveries.recipientItemId, recipientItemId),
        ),
      );

    return delivery;
  }

  async findEmailTemplatePublicationById(
    templateId: UUIDType,
    transaction: DatabasePg,
    lock = false,
  ) {
    const query = transaction
      .select({
        status: emailTemplates.status,
        publication: emailTemplates.publication,
        publicationVersion: emailTemplates.publicationVersion,
      })
      .from(emailTemplates)
      .where(eq(emailTemplates.id, templateId));

    const [template] = await (lock ? query.for("update") : query);

    return template;
  }

  async updateAutomationEmailDelivery(
    emailDeliveryId: UUIDType,
    values: UpdateAutomationEmailDelivery,
    transaction: DatabasePg,
  ) {
    const [delivery] = await transaction
      .update(automationEmailDeliveries)
      .set(values)
      .where(eq(automationEmailDeliveries.id, emailDeliveryId))
      .returning();

    return delivery;
  }

  updateAutomationRunStatus(runId: UUIDType, status: AutomationRunStatus, transaction: DatabasePg) {
    return transaction.update(automationRuns).set({ status }).where(eq(automationRuns.id, runId));
  }
}
