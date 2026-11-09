import { Injectable } from "@nestjs/common";

import { UserActivityEvent } from "src/events";
import { OutboxEventsHandler } from "src/outbox/outbox.decorators";

import { StatisticsService } from "../statistics.service";

import type { OutboxEventsHandlerOf } from "src/outbox/outbox.types";

@Injectable()
@OutboxEventsHandler(UserActivityEvent)
export class StatisticsHandler implements OutboxEventsHandlerOf<UserActivityEvent> {
  constructor(private readonly statisticsService: StatisticsService) {}

  async handleOutboxEvent({ userActivityData }: UserActivityEvent) {
    await this.statisticsService.updateUserActivity(userActivityData.userId);
  }
}
