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
import { SlackOAuthGuard } from "src/common/guards/slack-oauth.guard";
import { CurrentUser as CurrentUserType } from "src/common/types/current-user.type";
import { UserActivityEvent, UserLogoutEvent } from "src/events";
import { SettingsService } from "src/settings/settings.service";
import { baseUserResponseSchema, currentUserResponseSchema } from "src/user/schemas/user.schema";
import { USER_ROLES } from "src/user/schemas/userRoles";

import { AuthService } from "./auth.service";
import { CreateAccountBody, createAccountSchema } from "./schemas/create-account.schema";
import { type CreatePasswordBody, createPasswordSchema } from "./schemas/create-password.schema";
import { LoginBody, loginResponseSchema, loginSchema } from "./schemas/login.schema";
import {
  MFASetupResponseSchema,
  MFAVerifyBody,
  MFAVerifyResponseSchema,
  MFAVerifySchema,
} from "./schemas/mfa.schema";
import {
  ForgotPasswordBody,
  forgotPasswordSchema,
  ResetPasswordBody,
  resetPasswordSchema,
} from "./schemas/reset-password.schema";
import { TokenService } from "./token.service";

import type { Static } from "@sinclair/typebox";
import type { ProviderLoginUserType } from "src/utils/types/provider-login-user.type";

@Controller("auth")
export class AuthController {
  private CORS_ORIGIN: string;

  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly eventBus: EventBus,
    private readonly settingsService: SettingsService,
  ) {
    this.CORS_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:5173";
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
    const { enforceSSO, inviteOnlyRegistration } = await this.settingsService.getGlobalSettings();

    if (enforceSSO) {
      throw new UnauthorizedException("SSO is enforced, registration via email is not allowed");
    }

    if (inviteOnlyRegistration) {
      throw new UnauthorizedException("Registration is invite-only.");
    }

    const account = await this.authService.register(data);

    return new BaseResponse(account);
  }

  @Public()
  @UseGuards(AuthGuard("local"))
  @Post("login")
  @Validate({
    request: [{ type: "body", schema: loginSchema }],
    response: baseResponse(loginResponseSchema),
  })
  async login(
    @Body() data: LoginBody,
    @Res({ passthrough: true }) response: Response,
  ): Promise<BaseResponse<Static<typeof loginResponseSchema>>> {
    const { enforceSSO, MFAEnforcedRoles } = await this.settingsService.getGlobalSettings();

    if (enforceSSO) {
      throw new UnauthorizedException("SSO is enforced, login via email is not allowed");
    }

    const { accessToken, refreshToken, shouldVerifyMFA, ...account } = await this.authService.login(
      data,
      MFAEnforcedRoles,
    );

    shouldVerifyMFA
      ? this.tokenService.setTemporaryTokenCookies(response, accessToken, refreshToken)
      : this.tokenService.setTokenCookies(response, accessToken, refreshToken, data.rememberMe);

    return new BaseResponse({ ...account, shouldVerifyMFA });
  }

  @Post("logout")
  @Roles(...Object.values(USER_ROLES))
  @Validate({
    response: nullResponse(),
  })
  async logout(
    @Res({ passthrough: true }) response: Response,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<null> {
    this.tokenService.clearTokenCookies(response);

    this.eventBus.publish(new UserLogoutEvent({ userId: currentUser.userId, actor: currentUser }));
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
    response: baseResponse(currentUserResponseSchema),
  })
  async currentUser(
    @CurrentUser("userId") currentUserId: UUIDType,
  ): Promise<BaseResponse<Static<typeof currentUserResponseSchema>>> {
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
    await this.authService.createPassword(data);
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
    @Req() request: Request & { user: ProviderLoginUserType },
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const googleUser = request.user;

    try {
      const { accessToken, refreshToken, shouldVerifyMFA } =
        await this.authService.handleProviderLoginCallback(googleUser);

      shouldVerifyMFA
        ? this.tokenService.setTemporaryTokenCookies(response, accessToken, refreshToken)
        : this.tokenService.setTokenCookies(response, accessToken, refreshToken, true);

      response.redirect(this.CORS_ORIGIN);
    } catch (e) {
      response.redirect(
        this.CORS_ORIGIN + "/auth/login?error=" + encodeURIComponent((e as Error).message),
      );
    }
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
    @Req() request: Request & { user: ProviderLoginUserType },
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const microsoftUser = request.user;

    try {
      const { accessToken, refreshToken, shouldVerifyMFA } =
        await this.authService.handleProviderLoginCallback(microsoftUser);

      shouldVerifyMFA
        ? this.tokenService.setTemporaryTokenCookies(response, accessToken, refreshToken)
        : this.tokenService.setTokenCookies(response, accessToken, refreshToken, true);

      response.redirect(this.CORS_ORIGIN);
    } catch (e) {
      response.redirect(
        this.CORS_ORIGIN + "/auth/login?error=" + encodeURIComponent((e as Error).message),
      );
    }
  }

  @Public()
  @Get("slack")
  @UseGuards(SlackOAuthGuard)
  async slackAuth() {
    // Initiates the Slack OAuth flow
  }

  @Public()
  @Get("slack/callback")
  @UseGuards(SlackOAuthGuard)
  async slackAuthCallback(
    @Req() request: Request & { user: ProviderLoginUserType },
    @Res({ passthrough: true }) response: Response,
  ) {
    const slackUser = request.user;

    try {
      const { accessToken, refreshToken, shouldVerifyMFA } =
        await this.authService.handleProviderLoginCallback(slackUser);

      shouldVerifyMFA
        ? this.tokenService.setTemporaryTokenCookies(response, accessToken, refreshToken)
        : this.tokenService.setTokenCookies(response, accessToken, refreshToken, true);

      response.redirect(this.CORS_ORIGIN);
    } catch (e) {
      response.redirect(
        this.CORS_ORIGIN + "/auth/login?error=" + encodeURIComponent((e as Error).message),
      );
    }
  }

  @Post("mfa/setup")
  @Roles(...Object.values(USER_ROLES))
  @Validate({
    response: baseResponse(MFASetupResponseSchema),
  })
  async MFASetup(@CurrentUser("userId") userId: UUIDType) {
    const { secret, otpauth } = await this.authService.generateMFASecret(userId);

    return new BaseResponse({
      secret,
      otpauth,
    });
  }

  @Post("mfa/verify")
  @Roles(...Object.values(USER_ROLES))
  @Validate({
    request: [{ type: "body", schema: MFAVerifySchema }],
    response: baseResponse(MFAVerifyResponseSchema),
  })
  async MFAVerify(
    @Body() body: MFAVerifyBody,
    @CurrentUser("userId") userId: UUIDType,
    @Res({ passthrough: true }) response: Response,
  ) {
    const isValid = await this.authService.verifyMFACode(userId, body.token, response);

    return new BaseResponse({ isValid });
  }
}
