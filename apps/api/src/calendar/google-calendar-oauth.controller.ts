import { Controller, Get, Query, Res } from "@nestjs/common";
import { GOOGLE_CALENDAR_OAUTH_RESULTS, PERMISSIONS } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Response } from "express";
import { Validate } from "nestjs-typebox";

import { Public } from "src/common/decorators/public.decorator";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";

import { GoogleCalendarService } from "./services/google-calendar.service";

import type { GoogleCalendarOAuthResult } from "@repo/shared";

@Controller("auth/google-calendar")
export class GoogleCalendarOAuthController {
  constructor(private readonly googleCalendarService: GoogleCalendarService) {}

  @Get()
  @RequirePermission(PERMISSIONS.ACCOUNT_READ_SELF)
  @Validate({
    request: [
      { type: "query", name: "replace", schema: Type.Optional(Type.String()) },
      { type: "query", name: "outbound", schema: Type.Optional(Type.String()) },
    ],
  })
  async connectGoogleCalendar(
    @Query("replace") replace: string | undefined,
    @Query("outbound") outbound: string | undefined,
    @CurrentUser() currentUser: CurrentUserType,
    @Res() response: Response,
  ) {
    const authorizationUrl = await this.googleCalendarService.getAuthorizationUrl(
      currentUser,
      replace === "true",
      outbound === "true",
    );
    response.redirect(authorizationUrl);
  }

  @Public()
  @Get("callback")
  async completeGoogleCalendarAuthorization(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() response: Response,
  ) {
    if (!state) {
      return this.redirectToIntegrations(
        response,
        "",
        GOOGLE_CALENDAR_OAUTH_RESULTS.AUTHORIZATION_FAILED,
      );
    }

    if (error || !code) {
      const failure = await this.googleCalendarService.handleAuthorizationFailure(state);
      return this.redirectToIntegrations(
        response,
        failure?.origin ?? "",
        GOOGLE_CALENDAR_OAUTH_RESULTS.AUTHORIZATION_FAILED,
      );
    }

    try {
      const authorization = await this.googleCalendarService.completeAuthorization({
        code,
        state,
      });
      return this.redirectToIntegrations(response, authorization.origin, authorization.result);
    } catch {
      const failure = await this.googleCalendarService.handleAuthorizationFailure(state);
      return this.redirectToIntegrations(
        response,
        failure?.origin ?? "",
        GOOGLE_CALENDAR_OAUTH_RESULTS.AUTHORIZATION_FAILED,
      );
    }
  }

  private redirectToIntegrations(
    response: Response,
    origin: string,
    result: GoogleCalendarOAuthResult,
  ) {
    return response.redirect(
      `${origin}/settings?tab=integrations&googleCalendar=${encodeURIComponent(result)}`,
    );
  }
}
