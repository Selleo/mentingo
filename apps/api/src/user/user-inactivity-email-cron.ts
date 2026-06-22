import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";

import { UsersLongInactivityEvent } from "src/events/user/user-long-inactivity.event";
import { UsersShortInactivityEvent } from "src/events/user/user-short-inactivity.event";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { UserService } from "src/user/user.service";

@Injectable()
export class UserInactivityEmailCron {
  constructor(
    private readonly userService: UserService,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async checkUsersInactivity() {
    await this.tenantRunner.runForEachTenant(async (tenantId) => {
      const { shortInactivity, longInactivity } = await this.userService.checkUsersInactivity();

      if (shortInactivity.length) {
        await this.outboxPublisher.publish(
          new UsersShortInactivityEvent({ tenantId, users: shortInactivity }),
        );
      }

      if (longInactivity.length) {
        await this.outboxPublisher.publish(
          new UsersLongInactivityEvent({ tenantId, users: longInactivity }),
        );
      }
    });
  }
}
