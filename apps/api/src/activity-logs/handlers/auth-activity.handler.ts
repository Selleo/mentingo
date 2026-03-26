import { Injectable } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";

import {
  SupportModeEnterEvent,
  UserLoginEvent,
  UserLogoutEvent,
  UserLoginFailedEvent,
} from "src/events";

import { ActivityLogsService } from "../activity-logs.service";
import { ACTIVITY_LOG_ACTION_TYPES, ACTIVITY_LOG_RESOURCE_TYPES } from "../types";

type AuthEventType =
  | UserLoginEvent
  | UserLogoutEvent
  | SupportModeEnterEvent
  | UserLoginFailedEvent;

@Injectable()
@EventsHandler(UserLoginEvent, UserLogoutEvent, SupportModeEnterEvent, UserLoginFailedEvent)
export class AuthActivityHandler implements IEventHandler<AuthEventType> {
  constructor(private readonly activityLogsService: ActivityLogsService) {}

  async handle(event: AuthEventType) {
    if (event instanceof UserLoginEvent) return await this.handleLogin(event);
    if (event instanceof UserLogoutEvent) return await this.handleLogout(event);
    if (event instanceof SupportModeEnterEvent) return await this.handleSupportModeEnter(event);
    if (event instanceof UserLoginFailedEvent) return await this.handleLoginFailed(event);
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

  private async handleSupportModeEnter(event: SupportModeEnterEvent) {
    const context = {
      method: "support_mode_enter",
      supportSessionId: event.supportModeEnterData.supportSessionId,
      sourceTenantId: event.supportModeEnterData.sourceTenantId,
      targetTenantId: event.supportModeEnterData.targetTenantId,
    };

    await this.activityLogsService.recordActivity({
      actor: event.supportModeEnterData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.LOGIN,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.USER,
      resourceId: event.supportModeEnterData.sourceUserId,
      context,
    });
  }

  async handleLoginFailed(event: UserLoginFailedEvent) {
    const context = {
      method: event.loginFailedData.method,
      error: event.loginFailedData.error ?? "",
    };

    await this.activityLogsService.recordActivity({
      actor: event.loginFailedData.actor,
      operation: ACTIVITY_LOG_ACTION_TYPES.LOGIN_FAILED,
      resourceType: ACTIVITY_LOG_RESOURCE_TYPES.USER,
      resourceId: event.loginFailedData.userId,
      context,
    });
  }
}
