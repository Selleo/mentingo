import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { HostedVideoStatusService } from "./hosted-video-status.service";

@Injectable()
export class HostedVideoStatusCron {
  constructor(private readonly hostedVideoStatusService: HostedVideoStatusService) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async checkUnfinishedVideoStatuses(): Promise<void> {
    await this.hostedVideoStatusService.checkUnfinishedVideoStatuses();
  }
}
