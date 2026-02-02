import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import { UserLoginEvent, UserLogoutEvent } from "src/events";

import { ActivityLogsService } from "../activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";

type AuthEventType = UserLoginEvent | UserLogoutEvent;

@Injectable()
@EventsHandler(UserLoginEvent, UserLogoutEvent)
export class AuthActivityHandler implements IEventHandler<AuthEventType> {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handle(event: AuthEventType) {
    if (event instanceof UserLoginEvent) return await this.handleLogin(event);
    if (event instanceof UserLogoutEvent) return await this.handleLogout(event);
  }

  private async handleLogin(event: UserLoginEvent) {
    const context = { method: event.loginData.method };

    await this.activityLogsService.recordActivity({
      actor: event.loginData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.LOGIN,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.USER,
      resourceId: event.loginData.userId,
      context,
    });
  }

  private async handleLogout(event: UserLogoutEvent) {
    await this.activityLogsService.recordActivity({
      actor: event.logoutData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.LOGOUT,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.USER,
      resourceId: event.logoutData.userId,
    });
  }
}
