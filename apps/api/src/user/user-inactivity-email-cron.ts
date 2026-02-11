import { Injectable } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

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

  @Cron("0 9 * * *")
  async checkUsersInactivity() {
    await this.tenantRunner.runForEachTenant(async () => {
      const studentsToNotify = await this.userService.checkUsersInactivity();

      if (studentsToNotify.shortInactivity) {
        await this.outboxPublisher.publish(
          new UsersShortInactivityEvent({ users: studentsToNotify.shortInactivity }),
        );
      }

      if (studentsToNotify.longInactivity) {
        await this.outboxPublisher.publish(
          new UsersLongInactivityEvent({ users: studentsToNotify.longInactivity }),
        );
      }
    });
  }
}
