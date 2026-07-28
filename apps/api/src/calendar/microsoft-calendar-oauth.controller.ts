import { Controller, Get, Query, Res } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { Type } from "@sinclair/typebox";
import { Response } from "express";
import { Validate } from "nestjs-typebox";

import { Public } from "src/common/decorators/public.decorator";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";

import { MICROSOFT_CALENDAR_OAUTH_RESULTS } from "./calendar.constants";
import { MicrosoftCalendarService } from "./services/microsoft-calendar.service";

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
