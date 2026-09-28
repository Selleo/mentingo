import { Body, Controller, Delete, Get, Post, Res, UseGuards } from "@nestjs/common";
import { PERMISSIONS } from "@repo/shared";
import { Response } from "express";
import { Validate } from "nestjs-typebox";

import { loginResponseSchema, type LoginResponse } from "src/auth/schemas/login.schema";
import { baseResponse, BaseResponse } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { DisallowInSupportModeGuard } from "src/common/guards/disallow-support-mode.guard";
import { CurrentUserType } from "src/common/types/current-user.type";

import { PhoneAuthService } from "./phone-auth.service";
import {
  type PhoneAuthConfigResponse,
  phoneAuthConfigResponseSchema,
  type RequestPhoneCodeBody,
  type RequestPhoneCodeResponse,
  requestPhoneCodeResponseSchema,
  requestPhoneCodeSchema,
  type UserPhoneResponse,
  userPhoneResponseSchema,
  type VerifyPhoneAttachBody,
  verifyPhoneAttachSchema,
  type VerifyPhoneLoginBody,
  verifyPhoneLoginSchema,
} from "./schemas/phone-auth.schema";

@Controller("auth/phone")
export class PhoneAuthController {
  constructor(private readonly phoneAuthService: PhoneAuthService) {}

  @Public()
  @Get("config")
  @Validate({
    response: baseResponse(phoneAuthConfigResponseSchema),
  })
  async getPhoneAuthConfig(): Promise<BaseResponse<PhoneAuthConfigResponse>> {
    return new BaseResponse({ enabled: this.phoneAuthService.isEnabled() });
  }

  @Public()
  @Post("request-code")
  @Validate({
    request: [{ type: "body", schema: requestPhoneCodeSchema }],
    response: baseResponse(requestPhoneCodeResponseSchema),
  })
  async requestLoginCode(
    @Body() body: RequestPhoneCodeBody,
  ): Promise<BaseResponse<RequestPhoneCodeResponse>> {
    return new BaseResponse(await this.phoneAuthService.requestLoginCode(body.phone));
  }

  @Public()
  @Post("verify")
  @Validate({
    request: [{ type: "body", schema: verifyPhoneLoginSchema }],
    response: baseResponse(loginResponseSchema),
  })
  async verifyLoginCode(
    @Body() body: VerifyPhoneLoginBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<BaseResponse<LoginResponse>> {
    return new BaseResponse(await this.phoneAuthService.verifyLoginCode(body, response));
  }
}

@Controller("user/phone")
@UseGuards(DisallowInSupportModeGuard)
export class UserPhoneController {
  constructor(private readonly phoneAuthService: PhoneAuthService) {}

  @Post("request-code")
  @RequirePermission(PERMISSIONS.ACCOUNT_UPDATE_SELF)
  @Validate({
    request: [{ type: "body", schema: requestPhoneCodeSchema }],
    response: baseResponse(requestPhoneCodeResponseSchema),
  })
  async requestAttachCode(
    @Body() body: RequestPhoneCodeBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<RequestPhoneCodeResponse>> {
    return new BaseResponse(await this.phoneAuthService.requestAttachCode(currentUser, body.phone));
  }

  @Post("verify")
  @RequirePermission(PERMISSIONS.ACCOUNT_UPDATE_SELF)
  @Validate({
    request: [{ type: "body", schema: verifyPhoneAttachSchema }],
    response: baseResponse(userPhoneResponseSchema),
  })
  async verifyAttachCode(
    @Body() body: VerifyPhoneAttachBody,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<UserPhoneResponse>> {
    return new BaseResponse(await this.phoneAuthService.verifyAttachCode(currentUser, body));
  }

  @Delete()
  @RequirePermission(PERMISSIONS.ACCOUNT_UPDATE_SELF)
  @Validate({
    response: baseResponse(userPhoneResponseSchema),
  })
  async removeOwnPhone(
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<UserPhoneResponse>> {
    return new BaseResponse(await this.phoneAuthService.removeOwnPhone(currentUser));
  }
}
