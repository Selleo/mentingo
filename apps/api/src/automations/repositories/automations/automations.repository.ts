import { Inject, Injectable } from "@nestjs/common";

import { DatabasePg } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { automations } from "src/storage/schema";

import type { CreateAutomationRecordInput } from "src/announcements/types/automations-source.types";

@Injectable()
export class AutomationsRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async createAutomation(input: CreateAutomationRecordInput) {
    const [automation] = await this.db
      .insert(automations)
      .values({
        name: input.name,
        description: input.description,
        status: input.status,
      })
      .returning();

    return automation;
  }
}
