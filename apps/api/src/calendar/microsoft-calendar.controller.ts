import { Body, Controller, Delete, Get, HttpCode, Logger, Post, Query, Res } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Response } from "express";
import { Validate } from "nestjs-typebox";

import { BaseResponse, nullResponse } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";

import { MICROSOFT_CALENDAR_OAUTH_RESULTS } from "./calendar.constants";
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

    if (validationToken) {
      return response.status(200).type("text/plain").send(validationToken);
    }

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

    if (validationToken) {
      return response.status(200).type("text/plain").send(validationToken);
    }

    await Promise.all(
      (body?.value ?? []).map((notification) =>
        this.microsoftCalendarService.processNotification(notification, true),
      ),
    );
    return response.status(202).send();
  }
}

@Controller("auth/microsoft-calendar")
export class MicrosoftCalendarOAuthController {
  constructor(private readonly microsoftCalendarService: MicrosoftCalendarService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ACCOUNT_READ_SELF)
  @Validate({
    request: [
      { type: "query", name: "replace", schema: Type.Optional(Type.String()) },
      { type: "query", name: "outbound", schema: Type.Optional(Type.String()) },
    ],
  })
  async connect(
    @Query("replace") replace: string | undefined,
    @Query("outbound") outbound: string | undefined,
    @CurrentUser() currentUser: CurrentUserType,
    @Res() response: Response,
  ) {
    const authorizationUrl = await this.microsoftCalendarService.getAuthorizationUrl(
      currentUser,
      replace === "true",
      outbound === "true",
    );

    response.redirect(authorizationUrl);
  }

  @Public()
  @Get("callback")
  async callback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Query("error_description") errorDescription: string | undefined,
    @Res() response: Response,
  ) {
    if (!state) {
      return response.redirect(
        `/settings?tab=integrations&microsoftCalendar=${MICROSOFT_CALENDAR_OAUTH_RESULTS.AUTHORIZATION_FAILED}`,
      );
    }

    if (error || !code) {
      const failure = await this.microsoftCalendarService.handleAuthorizationFailure(
        state,
        `${error ?? ""} ${errorDescription ?? ""}`,
      );

      if (!failure) {
        return response.redirect(
          `/settings?tab=integrations&microsoftCalendar=${MICROSOFT_CALENDAR_OAUTH_RESULTS.AUTHORIZATION_FAILED}`,
        );
      }

      return response.redirect(
        `${failure.origin}/settings?tab=integrations&microsoftCalendar=${encodeURIComponent(failure.result)}`,
      );
    }

    try {
      const result = await this.microsoftCalendarService.completeAuthorization({ code, state });
      return response.redirect(
        `${result.origin}/settings?tab=integrations&microsoftCalendar=${encodeURIComponent(result.result)}`,
      );
    } catch (authorizationError) {
      const failure = await this.microsoftCalendarService.handleAuthorizationFailure(
        state,
        authorizationError,
      );
      const origin = failure?.origin ?? "";
      const result = failure?.result ?? MICROSOFT_CALENDAR_OAUTH_RESULTS.AUTHORIZATION_FAILED;
      return response.redirect(
        `${origin}/settings?tab=integrations&microsoftCalendar=${encodeURIComponent(result)}`,
      );
    }
  }
}
