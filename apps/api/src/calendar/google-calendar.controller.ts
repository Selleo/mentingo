import { Body, Controller, Delete, Get, Headers, HttpCode, Post } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { Validate } from "nestjs-typebox";

import { BaseResponse, nullResponse } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { CurrentUserType } from "src/common/types/current-user.type";

import {
  googleCalendarConnectionResponseSchema,
  googleCalendarOutboundUpdateResponseSchema,
  googleCalendarOutboundUpdateSchema,
  type GoogleCalendarConnectionResponse,
  type GoogleCalendarOutboundUpdateBody,
  type GoogleCalendarOutboundUpdateResult,
} from "./schemas/google-calendar-connection.schema";
import { GoogleCalendarService } from "./services/google-calendar.service";

@Controller("calendar/google")
export class GoogleCalendarController {
  constructor(private readonly googleCalendarService: GoogleCalendarService) {}

  @Get("connection")
  @RequirePermission(PERMISSIONS.ACCOUNT_READ_SELF)
  @Validate({ response: googleCalendarConnectionResponseSchema })
  async getGoogleCalendarConnection(
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<GoogleCalendarConnectionResponse>> {
    return new BaseResponse(await this.googleCalendarService.getConnection(currentUser));
  }

  @Post("connection/sync")
  @RequirePermission(PERMISSIONS.ACCOUNT_READ_SELF)
  @Validate({ response: nullResponse() })
  async syncGoogleCalendar(@CurrentUser() currentUser: CurrentUserType): Promise<null> {
    await this.googleCalendarService.requestManualSync(currentUser);
    return null;
  }

  @Post("connection/outbound")
  @RequirePermission(PERMISSIONS.ACCOUNT_READ_SELF)
  @Validate({
    request: [{ type: "body", schema: googleCalendarOutboundUpdateSchema }],
    response: googleCalendarOutboundUpdateResponseSchema,
  })
  async updateGoogleCalendarOutboundSync(
    @Body() body: GoogleCalendarOutboundUpdateBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<GoogleCalendarOutboundUpdateResult>> {
    return new BaseResponse(
      await this.googleCalendarService.setOutboundSync(currentUser, body.enabled),
    );
  }

  @Delete("connection")
  @RequirePermission(PERMISSIONS.ACCOUNT_READ_SELF)
  @Validate({ response: nullResponse() })
  async disconnectGoogleCalendar(@CurrentUser() currentUser: CurrentUserType): Promise<null> {
    await this.googleCalendarService.disconnect(currentUser);
    return null;
  }

  @Public()
  @Post("notifications")
  @HttpCode(200)
  async receiveGoogleCalendarNotification(
    @Headers("x-goog-channel-id") channelId: string | undefined,
    @Headers("x-goog-channel-token") channelToken: string | undefined,
    @Headers("x-goog-resource-state") resourceState: string | undefined,
  ): Promise<void> {
    await this.googleCalendarService.processNotification({
      channelId,
      channelToken,
      resourceState,
    });
  }
}
