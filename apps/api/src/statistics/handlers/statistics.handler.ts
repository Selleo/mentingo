import { Injectable } from "@nestjs/common";
import { EventsHandler } from "@nestjs/cqrs";

import { UserActivityEvent } from "src/events";

import { StatisticsService } from "../statistics.service";

import type { IEventHandler } from "@nestjs/cqrs";

@Injectable()
@EventsHandler(UserActivityEvent)
export class StatisticsHandler implements IEventHandler<UserActivityEvent> {
  constructor(private readonly statisticsService: StatisticsService) {}

  async handle(event: UserActivityEvent) {
    try {
      await this.handleUserActivity(event);
    } catch (error) {
      console.error("Error handling event:", error);
    }
  }

  private async handleUserActivity(event: UserActivityEvent) {
    await this.statisticsService.updateUserActivity(event.userId);
  }
}
