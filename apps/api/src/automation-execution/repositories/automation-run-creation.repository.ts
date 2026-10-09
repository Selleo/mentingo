import { Injectable } from "@nestjs/common";

import {
  automationOccurrences,
  automationRuns,
  automationEmailDeliveries,
} from "src/storage/schema";

import type {
  CreateAutomationEmailDelivery,
  CreateAutomationRun,
} from "../automation-execution.types";
import type { DatabasePg } from "src/common";

@Injectable()
export class AutomationRunCreationRepository {
  async insertNotificationOccurrenceIfNew(occurrenceId: string, transaction: DatabasePg) {
    const [occurrence] = await transaction
      .insert(automationOccurrences)
      .values({ occurrenceId })
      .onConflictDoNothing()
      .returning({ occurrenceId: automationOccurrences.occurrenceId });

    return occurrence;
  }

  async insertAutomationRun(values: CreateAutomationRun, transaction: DatabasePg) {
    const [run] = await transaction.insert(automationRuns).values(values).returning();

    return run;
  }

  async insertAutomationEmailDelivery(
    values: CreateAutomationEmailDelivery,
    transaction: DatabasePg,
  ) {
    const [delivery] = await transaction
      .insert(automationEmailDeliveries)
      .values(values)
      .returning({ id: automationEmailDeliveries.id });

    return delivery;
  }
}
