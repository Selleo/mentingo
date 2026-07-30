import { Body, Controller, Delete, Get, HttpCode, Logger, Post, Query, Res } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { Response } from "express";
import { Validate } from "nestjs-typebox";

import { BaseResponse, nullResponse } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";

import {
  microsoftCalendarConnectionResponseSchema,
  microsoftCalendarOutboundUpdateResponseSchema,
  microsoftCalendarOutboundUpdateSchema,
  microsoftGraphNotificationBodySchema,
  microsoftGraphValidationTokenSchema,
} from "./schemas/microsoft-calendar-connection.schema";
import { MicrosoftCalendarService } from "./services/microsoft-calendar.service";
import { MicrosoftGraphNotificationBody } from "./types/microsoft-calendar.types";

import type { MicrosoftCalendarConnectionResponse } from "./types/calendar.types";

@Controller("calendar/microsoft")
export class MicrosoftCalendarController {
  private readonly logger = new Logger(MicrosoftCalendarController.name);

  constructor(private readonly microsoftCalendarService: MicrosoftCalendarService) {}

  @Get("connection")
  @RequirePermission(PERMISSIONS.ACCOUNT_READ_SELF)
  @Validate({ response: microsoftCalendarConnectionResponseSchema })
  async getConnection(
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<MicrosoftCalendarConnectionResponse>> {
    return new BaseResponse(await this.microsoftCalendarService.getConnection(currentUser));
  }

  @Post("connection/sync")
  @RequirePermission(PERMISSIONS.ACCOUNT_READ_SELF)
  @Validate({ response: nullResponse() })
  async sync(@CurrentUser() currentUser: CurrentUserType): Promise<null> {
    await this.microsoftCalendarService.requestManualSync(currentUser);
    return null;
  }

  @Post("connection/outbound")
  @RequirePermission(PERMISSIONS.ACCOUNT_READ_SELF)
  @Validate({
    request: [{ type: "body", schema: microsoftCalendarOutboundUpdateSchema }],
    response: microsoftCalendarOutboundUpdateResponseSchema,
  })
  async updateOutbound(
    @Body() body: { enabled: boolean },
    @CurrentUser() currentUser: CurrentUserType,
  ) {
    return new BaseResponse(
      await this.microsoftCalendarService.setOutboundSync(currentUser, body.enabled),
    );
  }

  @Delete("connection")
  @RequirePermission(PERMISSIONS.ACCOUNT_READ_SELF)
  @Validate({ response: nullResponse() })
  async disconnect(@CurrentUser() currentUser: CurrentUserType): Promise<null> {
    await this.microsoftCalendarService.disconnect(currentUser);
    return null;
  }

  @Public()
  @Post("notifications")
  @HttpCode(202)
  @Validate({
    request: [
      { type: "query", name: "validationToken", schema: microsoftGraphValidationTokenSchema },
      { type: "body", schema: microsoftGraphNotificationBodySchema },
    ],
  })
  async notifications(
    @Query("validationToken") validationToken: string | undefined,
    @Body() body: MicrosoftGraphNotificationBody,
    @Res() response: Response,
  ) {
    this.logger.log(
      `Microsoft calendar webhook endpoint called: validation=${Boolean(validationToken)} notifications=${body?.value?.length ?? 0}`,
    );
    if (validationToken) return response.status(200).type("text/plain").send(validationToken);
    await Promise.all(
      (body?.value ?? []).map((notification) =>
        this.microsoftCalendarService.processNotification(notification, false),
      ),
    );
    return response.status(202).send();
  }

  @Public()
  @Post("lifecycle-notifications")
  @HttpCode(202)
  @Validate({
    request: [
      { type: "query", name: "validationToken", schema: microsoftGraphValidationTokenSchema },
      { type: "body", schema: microsoftGraphNotificationBodySchema },
    ],
  })
  async lifecycleNotifications(
    @Query("validationToken") validationToken: string | undefined,
    @Body() body: MicrosoftGraphNotificationBody,
    @Res() response: Response,
  ) {
    this.logger.log(
      `Microsoft calendar lifecycle webhook endpoint called: validation=${Boolean(validationToken)} notifications=${body?.value?.length ?? 0}`,
    );
    if (validationToken) return response.status(200).type("text/plain").send(validationToken);
    await Promise.all(
      (body?.value ?? []).map((notification) =>
        this.microsoftCalendarService.processNotification(notification, true),
      ),
    );
    return response.status(202).send();
  }
}
