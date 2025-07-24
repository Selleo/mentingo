import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import { AuthGuard } from "@nestjs/passport";
import { type Request, Response } from "express";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, nullResponse, type UUIDType } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { Roles } from "src/common/decorators/roles.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { GoogleOAuthGuard } from "src/common/guards/google-oauth.guard";
import { MicrosoftOAuthGuard } from "src/common/guards/microsoft-oauth.guard";
import { RefreshTokenGuard } from "src/common/guards/refresh-token.guard";
import { UserActivityEvent } from "src/events";
import { baseUserResponseSchema } from "src/user/schemas/user.schema";
import { USER_ROLES } from "src/user/schemas/userRoles";

import { AuthService } from "./auth.service";
import { CreateAccountBody, createAccountSchema } from "./schemas/create-account.schema";
import { type CreatePasswordBody, createPasswordSchema } from "./schemas/create-password.schema";
import { LoginBody, loginSchema } from "./schemas/login.schema";
import {
  ForgotPasswordBody,
  forgotPasswordSchema,
  ResetPasswordBody,
  resetPasswordSchema,
} from "./schemas/reset-password.schema";
import { TokenService } from "./token.service";

import type { Static } from "@sinclair/typebox";
import type { GoogleUserType } from "src/utils/types/google-user.type";
import type { MicrosoftUserType } from "src/utils/types/microsoft-user.type";

@Controller("auth")
export class AuthController {
  private APP_URL: string;

  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly eventBus: EventBus,
  ) {
    this.APP_URL = process.env.APP_URL || "http://localhost:5173";
  }

  @Public()
  @Post("register")
  @Validate({
    request: [{ type: "body", schema: createAccountSchema }],
    response: baseResponse(baseUserResponseSchema),
  })
  async register(
    data: CreateAccountBody,
  ): Promise<BaseResponse<Static<typeof baseUserResponseSchema>>> {
    const { avatarReference: _, ...account } = await this.authService.register(data);

    return new BaseResponse(account);
  }

  @Public()
  @UseGuards(AuthGuard("local"))
  @Post("login")
  @Validate({
    request: [{ type: "body", schema: loginSchema }],
    response: baseResponse(baseUserResponseSchema),
  })
  async login(
    @Body() data: LoginBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<BaseResponse<Static<typeof baseUserResponseSchema>>> {
    const {
      accessToken,
      refreshToken,
      avatarReference: _,
      ...account
    } = await this.authService.login(data);

    this.tokenService.setTokenCookies(response, accessToken, refreshToken, data?.rememberMe);

    return new BaseResponse(account);
  }

  @Post("logout")
  @Roles(...Object.values(USER_ROLES))
  @Validate({
    response: nullResponse(),
  })
  async logout(@Res({ passthrough: true }) response: Response): Promise<null> {
    this.tokenService.clearTokenCookies(response);

    return null;
  }

  @Public()
  @UseGuards(RefreshTokenGuard)
  @Post("refresh")
  @Validate({
    response: nullResponse(),
  })
  async refreshTokens(
    @Res({ passthrough: true }) response: Response,
    @Req() request: Request & { refreshToken: UUIDType },
  ): Promise<null> {
    const refreshToken = request["refreshToken"];

    if (!refreshToken) {
      throw new UnauthorizedException("Refresh token not found");
    }

    try {
      const { accessToken, refreshToken: newRefreshToken } =
        await this.authService.refreshTokens(refreshToken);

      this.tokenService.setTokenCookies(response, accessToken, newRefreshToken);

      return null;
    } catch (error) {
      console.error(error);
      throw new UnauthorizedException("Invalid refresh token");
    }
  }

  @Get("current-user")
  @Validate({
    response: baseResponse(baseUserResponseSchema),
  })
  async currentUser(
    @CurrentUser("userId") currentUserId: UUIDType,
  ): Promise<BaseResponse<Static<typeof baseUserResponseSchema>>> {
    const account = await this.authService.currentUser(currentUserId);

    this.eventBus.publish(new UserActivityEvent(currentUserId, "LOGIN"));

    return new BaseResponse(account);
  }

  @Public()
  @Post("forgot-password")
  @Validate({
    request: [{ type: "body", schema: forgotPasswordSchema }],
  })
  async forgotPassword(
    @Body() data: ForgotPasswordBody,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.authService.forgotPassword(data.email);
    return new BaseResponse({ message: "Password reset link sent" });
  }

  @Public()
  @Post("create-password")
  @Validate({
    request: [{ type: "body", schema: createPasswordSchema }],
  })
  async createPassword(
    @Body() data: CreatePasswordBody,
  ): Promise<BaseResponse<{ message: string }>> {
    await this.authService.createPassword(data.createToken, data.password);
    return new BaseResponse({ message: "Password created successfully" });
  }

  @Public()
  @Post("reset-password")
  @Validate({
    request: [{ type: "body", schema: resetPasswordSchema }],
  })
  async resetPassword(@Body() data: ResetPasswordBody): Promise<BaseResponse<{ message: string }>> {
    await this.authService.resetPassword(data.resetToken, data.newPassword);
    return new BaseResponse({ message: "Password reset successfully" });
  }

  @Public()
  @Get("google")
  @UseGuards(GoogleOAuthGuard)
  async googleAuth(@Req() _request: Request): Promise<void> {
    // Initiates the Google OAuth flow
    // The actual redirection to Google happens in the AuthGuard
  }

  @Public()
  @Get("google/callback")
  @UseGuards(GoogleOAuthGuard)
  async googleAuthCallback(
    @Req() request: Request & { user: GoogleUserType },
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const googleUser = request.user;

    const { accessToken, refreshToken } =
      await this.authService.handleProviderLoginCallback(googleUser);

    this.tokenService.setTokenCookies(response, accessToken, refreshToken, true);

    response.redirect(this.APP_URL);
  }

  @Public()
  @Get("microsoft")
  @UseGuards(MicrosoftOAuthGuard)
  async microsoftAuth() {
    // Initiates the Microsoft OAuth flow
  }

  @Public()
  @Get("microsoft/callback")
  @UseGuards(MicrosoftOAuthGuard)
  async microsoftAuthCallback(
    @Req() request: Request & { user: MicrosoftUserType },
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const microsoftUser = request.user;

    const { accessToken, refreshToken } =
      await this.authService.handleProviderLoginCallback(microsoftUser);

    this.tokenService.setTokenCookies(response, accessToken, refreshToken, true);

    response.redirect(this.APP_URL);
  }
}
