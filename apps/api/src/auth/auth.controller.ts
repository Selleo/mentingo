import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";
import { PERMISSIONS } from "@repo/shared";
import { Type, type Static } from "@sinclair/typebox";
import { type Request, Response } from "express";
import { Validate } from "nestjs-typebox";

import { baseResponse, BaseResponse, nullResponse, type UUIDType } from "src/common";
import { Public } from "src/common/decorators/public.decorator";
import { RequirePermission } from "src/common/decorators/require-permission.decorator";
import { CurrentUser } from "src/common/decorators/user.decorator";
import { GoogleOAuthGuard } from "src/common/guards/google-oauth.guard";
import { MicrosoftOAuthGuard } from "src/common/guards/microsoft-oauth.guard";
import { RefreshTokenGuard } from "src/common/guards/refresh-token.guard";
import { SlackOAuthGuard } from "src/common/guards/slack-oauth.guard";
import {
  isSupportModeSession,
  shouldEmitUserScopedEvents,
} from "src/common/helpers/support-mode-context";
import {
  CurrentUser as CurrentUserType,
  type SupportModeCurrentUser,
} from "src/common/types/current-user.type";
import { SupportModeEnterEvent, UserActivityEvent, UserLogoutEvent } from "src/events";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { SettingsService } from "src/settings/settings.service";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { baseUserResponseSchema, currentUserResponseSchema } from "src/user/schemas/user.schema";

import { AuthService } from "./auth.service";
import { CreateAccountBody, createAccountSchema } from "./schemas/create-account.schema";
import { type CreatePasswordBody, createPasswordSchema } from "./schemas/create-password.schema";
import { LoginBody, loginResponseSchema, loginSchema } from "./schemas/login.schema";
import {
  CreateMagicLinkBody,
  createMagicLinkResponseSchema,
  createMagicLinkSchema,
} from "./schemas/magic-link.schema";
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

import type { LoginResponse } from "./schemas/login.schema";
import type { ProviderLoginUserType } from "src/utils/types/provider-login-user.type";

@Controller("auth")
export class AuthController {
  private CORS_ORIGIN: string;

  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly settingsService: SettingsService,
    private readonly tenantRunner: TenantDbRunnerService,
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

    if (enforceSSO) throw new UnauthorizedException("ssoEnforcementView.toast.registerRedirect");

    if (inviteOnlyRegistration)
      throw new UnauthorizedException("inviteOnlyRegistrationView.toast.registerRedirect");

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
  @RequirePermission(PERMISSIONS.ACCOUNT_READ_SELF)
  @Validate({
    response: nullResponse(),
  })
  async logout(
    @Res({ passthrough: true }) response: Response,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<null> {
    if (isSupportModeSession(currentUser)) {
      await this.authService.revokeSupportSession(currentUser.supportSessionId);
      this.tokenService.clearTokenCookies(response);
      return null;
    }

    this.tokenService.clearTokenCookies(response);

    await this.outboxPublisher.publish(
      new UserLogoutEvent({ userId: currentUser.userId, actor: currentUser }),
    );
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
  @RequirePermission(PERMISSIONS.ACCOUNT_READ_SELF)
  @Validate({
    response: baseResponse(currentUserResponseSchema),
  })
  async currentUser(
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<BaseResponse<Static<typeof currentUserResponseSchema>>> {
    const account = await this.authService.currentUser(currentUser);

    if (isSupportModeSession(currentUser)) {
      await this.publishSupportModeEnterEvent(currentUser);
    }

    if (shouldEmitUserScopedEvents(currentUser)) {
      await this.outboxPublisher.publish(
        new UserActivityEvent({ userId: currentUser.userId, activityType: "LOGIN" }),
      );
    }

    return new BaseResponse(account);
  }

  private async publishSupportModeEnterEvent(currentUser: SupportModeCurrentUser): Promise<void> {
    const payload = {
      supportSessionId: currentUser.supportSessionId,
      sourceUserId: currentUser.originalUserId,
      sourceTenantId: currentUser.originalTenantId,
      targetUserId: currentUser.userId,
      targetTenantId: currentUser.tenantId,
      actor: currentUser,
    };

    const tenantIds = new Set([currentUser.originalTenantId, currentUser.tenantId]);

    for (const tenantId of tenantIds) {
      await this.tenantRunner.runWithTenant(tenantId, async () => {
        await this.outboxPublisher.publish(new SupportModeEnterEvent(payload));
      });
    }
  }

  @Public()
  @Get("support/callback")
  @Validate({
    request: [{ type: "query", name: "grant", schema: Type.String({ minLength: 1 }) }],
  })
  async supportCallback(
    @Query("grant") grant: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    const { accessToken, refreshToken } = await this.authService.createSupportModeTokens(grant);

    this.tokenService.setTokenCookies(response, accessToken, refreshToken, false);

    response.redirect("/");
  }

  @Post("support/exit")
  @RequirePermission(PERMISSIONS.ACCOUNT_UPDATE_SELF)
  @Validate({
    response: baseResponse(Type.Object({ redirectUrl: Type.String() })),
  })
  async exitSupportMode(
    @CurrentUser() currentUser: CurrentUserType,
    @Res({ passthrough: true }) response: Response,
  ): Promise<BaseResponse<{ redirectUrl: string }>> {
    if (!currentUser.isSupportMode || !currentUser.supportSessionId) {
      throw new BadRequestException("supportMode.errors.notInSupportMode");
    }

    await this.authService.revokeSupportSession(currentUser.supportSessionId);
    this.tokenService.clearTokenCookies(response);

    return new BaseResponse({ redirectUrl: currentUser.returnUrl ?? this.CORS_ORIGIN });
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
    await this.authService.resetPassword(data.resetToken, data.newPassword, data.email);
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
  @RequirePermission(PERMISSIONS.ACCOUNT_MFA)
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
  @RequirePermission(PERMISSIONS.ACCOUNT_MFA)
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

  @Public()
  @Post("magic-link/create")
  @Validate({
    request: [{ type: "body", schema: createMagicLinkSchema }],
    response: baseResponse(createMagicLinkResponseSchema),
  })
  async createMagicLink(@Body() body: CreateMagicLinkBody) {
    await this.authService.createMagicLink(body.email);

    return new BaseResponse({ message: "magicLink.createdSuccessfully" });
  }

  @Public()
  @Get("magic-link/verify")
  @Validate({
    request: [{ type: "query", schema: Type.String(), name: "token", required: true }],
    response: baseResponse(loginResponseSchema),
  })
  async handleMagicLink(
    @Query("token") token: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<BaseResponse<LoginResponse>> {
    const loginResponse = await this.authService.handleMagicLinkLogin(response, token);

    return new BaseResponse(loginResponse);
  }
}
