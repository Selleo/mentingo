import { Injectable, NotFoundException } from "@nestjs/common";

import { AutomationRunHistoryRepository } from "../repositories/automation-run-history.repository";

import type { AutomationRunQuery } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { automationRuns } from "src/storage/schema";

@Injectable()
export class AutomationRunHistoryService {
  constructor(private readonly automationRunHistoryRepository: AutomationRunHistoryRepository) {}

  async listAutomationRuns(query: AutomationRunQuery) {
    const result = await this.automationRunHistoryRepository.findAutomationRunPage(query);

    return { ...result, data: result.data.map((record) => this.mapAutomationRunSummary(record)) };
  }

  async getAutomationRun(id: UUIDType) {
    const result = await this.automationRunHistoryRepository.findAutomationRunDetails(id);

    if (!result.run) {
      throw new NotFoundException("automations.errors.logNotFound");
    }

    return { ...result, run: this.mapAutomationRunSummary(result.run) };
  }

  private mapAutomationRunSummary(record: typeof automationRuns.$inferSelect) {
    const {
      tenantId: _tenantId,
      updatedAt: _updatedAt,
      executionVersion: _executionVersion,
      ...runSummary
    } = record;

    return runSummary;
  }
}
