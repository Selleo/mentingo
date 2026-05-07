import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { OutboxDispatcherService } from "./outbox-dispatcher.service";

@Injectable()
export class OutboxDispatcherCron {
  constructor(private readonly outboxDispatcherService: OutboxDispatcherService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async dispatchOutboxEvents() {
    await this.outboxDispatcherService.dispatchPendingEvents();
  }
}
