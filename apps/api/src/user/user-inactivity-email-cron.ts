import { Injectable } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import { Cron } from "@nestjs/schedule";

import { UsersLongInactivityEvent } from "src/events/user/user-long-inactivity.event";
import { UsersShortInactivityEvent } from "src/events/user/user-short-inactivity.event";
import { UserService } from "src/user/user.service";

@Injectable()
export class UserInactivityEmailCron {
  constructor(
    private readonly userService: UserService,
    private readonly eventBus: EventBus,
  ) {}

  @Cron("0 9 * * *")
  async checkUsersInactivity() {
    const studentsToNotify = await this.userService.checkUsersInactivity();

    if (studentsToNotify.shortInactivity) {
      this.eventBus.publish(
        new UsersShortInactivityEvent({ users: studentsToNotify.shortInactivity }),
      );
    }

    if (studentsToNotify.longInactivity) {
      this.eventBus.publish(
        new UsersLongInactivityEvent({ users: studentsToNotify.longInactivity }),
      );
    }
  }
}
