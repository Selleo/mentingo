import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { CourseTransferCoordinator } from "./course-transfer.coordinator";

@Injectable()
export class CourseTransferRecoveryCron {
  constructor(private readonly courseTransferCoordinator: CourseTransferCoordinator) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async redispatchStalledTransfers(): Promise<void> {
    await this.courseTransferCoordinator.redispatchStalledTransfers();
  }
}
