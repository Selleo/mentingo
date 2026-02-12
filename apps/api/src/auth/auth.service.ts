import { createHmac } from "node:crypto";

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import {
  CreatePasswordReminderEmail,
  MagicLinkEmail,
  PasswordRecoveryEmail,
} from "@repo/email-templates";
import { SUPPORTED_LANGUAGES, type SupportedLanguages } from "@repo/shared";
import * as bcrypt from "bcryptjs";
import { and, eq, isNull, lt, lte, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { authenticator } from "otplib";

import { CORS_ORIGIN, MAGIC_LINK_EXPIRATION_TIME } from "src/auth/consts";
import { DatabasePg, type UUIDType } from "src/common";
import { EmailService } from "src/common/emails/emails.service";
import { getEmailSubject } from "src/common/emails/translations";
import hashPassword from "src/common/helpers/hashPassword";
import { UserLoginEvent } from "src/events/user/user-login.event";
import { UserPasswordCreatedEvent } from "src/events/user/user-password-created.event";
import { UserRegisteredEvent } from "src/events/user/user-registered.event";
import { UserWelcomeEvent } from "src/events/user/user-welcome.event";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { SettingsService } from "src/settings/settings.service";
import { USER_ROLES, type UserRole } from "src/user/schemas/userRoles";

import {
  createTokens,
  credentials,
  magicLinkTokens,
  resetTokens,
  tenants,
  userOnboarding,
  users,
} from "../storage/schema";
import { UserService } from "../user/user.service";

import { CreatePasswordService } from "./create-password.service";
import { ResetPasswordService } from "./reset-password.service";
import { TokenService } from "./token.service";

import type { CreatePasswordBody } from "./schemas/create-password.schema";
import type { TokenUser } from "./types";
import type { Response } from "express";
import type { ActorUserType } from "src/common/types/actor-user.type";
import type { CurrentUser } from "src/common/types/current-user.type";
import type { ProviderLoginUserType } from "src/utils/types/provider-login-user.type";

@Injectable()
export class AuthService {
  private readonly ENCRYPTION_KEY: Buffer;

  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    @Inject(forwardRef(() => UserService)) private readonly userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    private createPasswordService: CreatePasswordService,
    private resetPasswordService: ResetPasswordService,
    private settingsService: SettingsService,
    private readonly outboxPublisher: OutboxPublisher,
    private tokenService: TokenService,
  ) {
    this.ENCRYPTION_KEY = Buffer.from(process.env.MASTER_KEY!, "base64");
  }

  public async register({
    email,
    firstName,
    lastName,
    password,
    language,
  }: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    language: string;
  }) {
    const [existingUser] = await this.db.select().from(users).where(eq(users.email, email));
    if (existingUser) {
      throw new ConflictException("User already exists");
    }

    const hashedPassword = await hashPassword(password);

    const createdUser = await this.db.transaction(async (trx) => {
      const [newUser] = await trx
        .insert(users)
        .values({
          email,
          firstName,
          lastName,
        })
        .returning();

      await trx.insert(credentials).values({
        userId: newUser.id,
        password: hashedPassword,
      });

      await trx.insert(userOnboarding).values({ userId: newUser.id });
      const languageGuard = Object.values(SUPPORTED_LANGUAGES).includes(
        language as SupportedLanguages,
      )
        ? language
        : "en";

      await this.settingsService.createSettingsIfNotExists(
        newUser.id,
        newUser.role as UserRole,
        { language: languageGuard },
        trx,
      );

      const { avatarReference, ...userWithoutAvatar } = newUser;
      const usersProfilePictureUrl =
        await this.userService.getUsersProfilePictureUrl(avatarReference);

      await this.outboxPublisher.publish(new UserRegisteredEvent(newUser), trx);

      return { ...userWithoutAvatar, profilePictureUrl: usersProfilePictureUrl };
    });

    if (!createdUser) {
      throw new BadRequestException("Failed to create user");
    }

    await this.outboxPublisher.publish(
      new UserWelcomeEvent({
        email: createdUser.email,
        userId: createdUser.id,
        tenantId: createdUser.tenantId,
      }),
    );

    return createdUser;
  }

  public async login(data: { email: string; password: string }, MFAEnforcedRoles: UserRole[]) {
    const user = await this.validateUser(data.email, data.password);
    if (!user) {
      throw new UnauthorizedException("Invalid email or password");
    }

    if (user.archived) {
      throw new UnauthorizedException("Your account has been archived");
    }

    const { accessToken, refreshToken } = await this.getTokens(user);

    const { avatarReference, ...userWithoutAvatar } = user;
    const usersProfilePictureUrl =
      await this.userService.getUsersProfilePictureUrl(avatarReference);

    const userSettings = await this.settingsService.getUserSettings(user.id);

    const onboardingStatus = await this.userService.getAllOnboardingStatus(user.id);
    const isManagingTenantAdmin = await this.isManagingTenantAdmin(
      user.tenantId,
      user.role as UserRole,
    );

    const actor: ActorUserType = {
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
      tenantId: user.tenantId,
    };

    await this.outboxPublisher.publish(
      new UserLoginEvent({ userId: user.id, method: "password", actor }),
    );

    if (
      MFAEnforcedRoles.includes(userWithoutAvatar.role as UserRole) ||
      userSettings.isMFAEnabled
    ) {
      return {
        ...userWithoutAvatar,
        profilePictureUrl: usersProfilePictureUrl,
        accessToken,
        refreshToken,
        shouldVerifyMFA: true,
        onboardingStatus,
        isManagingTenantAdmin,
      };
    }

    return {
      ...userWithoutAvatar,
      profilePictureUrl: usersProfilePictureUrl,
      accessToken,
      refreshToken,
      shouldVerifyMFA: false,
      onboardingStatus,
      isManagingTenantAdmin,
    };
  }

  public async currentUser(id: UUIDType) {
    const user = await this.userService.getUserById(id);

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    const onboardingStatus = await this.userService.getAllOnboardingStatus(user.id);

    const { MFAEnforcedRoles } = await this.settingsService.getGlobalSettings();
    const userSettings = await this.settingsService.getUserSettings(user.id);
    const isManagingTenantAdmin = await this.isManagingTenantAdmin(
      user.tenantId,
      user.role as UserRole,
    );

    if (MFAEnforcedRoles.includes(user.role as UserRole) || userSettings.isMFAEnabled) {
      return { ...user, shouldVerifyMFA: true, onboardingStatus, isManagingTenantAdmin };
    }

    return { ...user, shouldVerifyMFA: false, onboardingStatus, isManagingTenantAdmin };
  }

  public async refreshTokens(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>("jwt.refreshSecret"),
        ignoreExpiration: false,
      });

      const user = await this.userService.getUserById(payload.userId);
      if (!user) {
        throw new UnauthorizedException("User not found");
      }

      const tokens = await this.getTokens(user);

      const actor: CurrentUser = {
        userId: user.id,
        email: user.email,
        role: user.role as UserRole,
        tenantId: user.tenantId,
      };

      await this.outboxPublisher.publish(
        new UserLoginEvent({ userId: user.id, method: "refresh_token", actor }),
      );

      return tokens;
    } catch (error) {
      throw new ForbiddenException("Invalid refresh token");
    }
  }

  public async validateUser(email: string, password: string) {
    const [userWithCredentials] = await this.db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        password: credentials.password,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        role: users.role,
        archived: users.archived,
        avatarReference: users.avatarReference,
        deletedAt: users.deletedAt,
        tenantId: users.tenantId,
      })
      .from(users)
      .leftJoin(credentials, eq(users.id, credentials.userId))
      .where(and(eq(users.email, email), isNull(users.deletedAt)));

    if (!userWithCredentials || !userWithCredentials.password) return null;

    const isPasswordValid = await bcrypt.compare(password, userWithCredentials.password);

    if (!isPasswordValid) return null;

    const { password: _, ...user } = userWithCredentials;

    return user;
  }

  private async getTokens(user: TokenUser) {
    const { id: userId, email, role, tenantId } = user;
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(
        { userId, email, role, tenantId },
        {
          expiresIn: this.configService.get<string>("jwt.expirationTime"),
          secret: this.configService.get<string>("jwt.secret"),
        },
      ),
      this.jwtService.signAsync(
        { userId, email, role, tenantId },
        {
          expiresIn: "7d",
          secret: this.configService.get<string>("jwt.refreshSecret"),
        },
      ),
    ]);

    return { accessToken, refreshToken };
  }

  public async forgotPassword(email: string) {
    const user = await this.userService.getUserByEmail(email);

    if (!user) throw new BadRequestException("Email not found");

    const resetToken = nanoid(64);
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + 1);

    await this.db.insert(resetTokens).values({
      userId: user.id,
      resetToken,
      expiryDate,
    });

    const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
      user.tenantId,
      user.id,
    );

    const emailTemplate = new PasswordRecoveryEmail({
      name: user.firstName,
      resetLink: `${CORS_ORIGIN}/auth/create-new-password?resetToken=${resetToken}&email=${email}`,
      ...defaultEmailSettings,
    });

    await this.emailService.sendEmailWithLogo(
      {
        to: email,
        subject: getEmailSubject("passwordRecoveryEmail", defaultEmailSettings.language),
        text: emailTemplate.text,
        html: emailTemplate.html,
      },
      { tenantId: user.tenantId },
    );
  }

  public async createPassword(data: CreatePasswordBody) {
    const { createToken: token, password, language } = data;
    const createToken = await this.createPasswordService.getOneByToken(token);

    const [existingUser] = await this.db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        role: users.role,
        archived: users.archived,
        avatarReference: users.avatarReference,
        deletedAt: users.deletedAt,
      })
      .from(users)
      .where(eq(users.id, createToken.userId));

    if (!existingUser) throw new NotFoundException("User not found");

    const hashedPassword = await hashPassword(password);

    await this.db
      .insert(credentials)
      .values({ userId: createToken.userId, password: hashedPassword });
    await this.createPasswordService.deleteToken(token);

    const languageGuard = Object.values(SUPPORTED_LANGUAGES).includes(
      language as SupportedLanguages,
    )
      ? language
      : "en";

    await this.settingsService.createSettingsIfNotExists(
      createToken.userId,
      existingUser.role as UserRole,
      { language: languageGuard },
    );

    await this.outboxPublisher.publish(new UserPasswordCreatedEvent({ ...existingUser }));

    return existingUser;
  }

  public async resetPassword(token: string, newPassword: string) {
    const resetToken = await this.resetPasswordService.getOneByToken(token);

    await this.userService.resetPassword(resetToken.userId, newPassword);
    await this.resetPasswordService.deleteToken(token);
  }

  private async fetchExpiredTokens() {
    return this.db
      .select({
        userId: createTokens.userId,
        email: users.email,
        oldCreateToken: createTokens.createToken,
        tokenExpiryDate: createTokens.expiryDate,
        reminderCount: createTokens.reminderCount,
      })
      .from(createTokens)
      .leftJoin(credentials, eq(createTokens.userId, credentials.userId))
      .innerJoin(users, eq(createTokens.userId, users.id))
      .where(
        and(
          isNull(credentials.userId),
          lte(sql`DATE(${createTokens.expiryDate})`, sql`CURRENT_DATE`),
          lt(createTokens.reminderCount, 3),
        ),
      );
  }

  private async generateNewTokenAndEmail(userId: UUIDType, email: string) {
    const createToken = nanoid(64);

    const user = await this.userService.getUserById(userId);

    const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
      user.tenantId,
      userId,
    );

    const emailTemplate = new CreatePasswordReminderEmail({
      createPasswordLink: `${CORS_ORIGIN}/auth/create-new-password?createToken=${createToken}&email=${email}`,
      ...defaultEmailSettings,
    });

    return { createToken, emailTemplate };
  }

  private async sendEmailAndUpdateDatabase(
    tenantId: UUIDType,
    userId: UUIDType,
    email: string,
    oldCreateToken: string,
    createToken: string,
    emailTemplate: { text: string; html: string },
    expiryDate: Date,
    reminderCount: number,
  ) {
    await this.db.transaction(async (transaction) => {
      try {
        await transaction.insert(createTokens).values({
          userId,
          createToken,
          expiryDate,
          reminderCount,
        });

        const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
          tenantId,
          userId,
        );

        await this.emailService.sendEmailWithLogo(
          {
            to: email,
            subject: getEmailSubject("passwordReminderEmail", defaultEmailSettings.language),
            text: emailTemplate.text,
            html: emailTemplate.html,
          },
          { tenantId },
        );

        await transaction.delete(createTokens).where(eq(createTokens.createToken, oldCreateToken));
      } catch (error) {
        transaction.rollback();

        throw error;
      }
    });
  }

  public async checkTokenExpiryAndSendEmail() {
    const expiryTokens = await this.fetchExpiredTokens();

    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + 24);

    expiryTokens.map(async ({ userId, email, oldCreateToken, reminderCount }) => {
      const user = await this.userService.getUserById(userId);
      const { createToken, emailTemplate } = await this.generateNewTokenAndEmail(userId, email);

      await this.sendEmailAndUpdateDatabase(
        user.tenantId,
        userId,
        email,
        oldCreateToken,
        createToken,
        emailTemplate,
        expiryDate,
        reminderCount + 1,
      );
    });
  }

  public async handleProviderLoginCallback(userCallback: ProviderLoginUserType) {
    if (!userCallback) {
      throw new UnauthorizedException("User data is missing");
    }

    const { inviteOnlyRegistration } = await this.settingsService.getGlobalSettings();
    let [user] = await this.db
      .select()
      .from(users)
      .where(and(eq(users.email, userCallback.email), isNull(users.deletedAt)));

    if (user?.archived) {
      throw new UnauthorizedException("Your account has been archived");
    }

    if (!user && inviteOnlyRegistration) {
      throw new UnauthorizedException("Registration is invite-only.");
    }

    if (!user && !inviteOnlyRegistration) {
      user = await this.userService.createUser({
        email: userCallback.email,
        firstName: userCallback.firstName,
        lastName: userCallback.lastName,
        role: USER_ROLES.STUDENT,
      });
    }

    const tokens = await this.getTokens(user);

    const userSettings = await this.settingsService.getUserSettings(user.id);
    const { MFAEnforcedRoles } = await this.settingsService.getGlobalSettings();

    const actor: ActorUserType = {
      userId: user.id,
      email: user.email,
      role: user.role as UserRole,
      tenantId: user.tenantId,
    };

    await this.outboxPublisher.publish(
      new UserLoginEvent({ userId: user.id, method: "provider", actor }),
    );

    if (MFAEnforcedRoles.includes(user.role as UserRole) || userSettings.isMFAEnabled) {
      return {
        ...tokens,
        shouldVerifyMFA: true,
      };
    }

    return {
      ...tokens,
      shouldVerifyMFA: false,
    };
  }

  async generateMFASecret(userId: string) {
    const user = await this.userService.getUserById(userId);

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    const secret = authenticator.generateSecret();

    const newSettings = await this.settingsService.updateUserSettings(userId, {
      MFASecret: secret,
    });

    if (!newSettings.MFASecret) {
      throw new BadRequestException("Failed to generate secret");
    }

    return {
      secret,
      otpauth: `otpauth://totp/Mentingo:${user.email}?secret=${secret}&issuer=Mentingo`,
    };
  }

  async verifyMFACode(userId: string, token: string, response: Response) {
    if (!userId || !token) {
      throw new BadRequestException("User ID and token are required");
    }

    const user = await this.userService.getUserById(userId);

    if (!user) {
      throw new NotFoundException("Failed to retrieve user");
    }

    const settings = await this.settingsService.getUserSettings(userId);

    if (!settings.MFASecret) return false;

    const isValid = authenticator.check(token, settings.MFASecret);

    if (!isValid) {
      throw new BadRequestException("Invalid MFA token");
    }

    const { refreshToken, accessToken } = await this.getTokens(user);

    this.tokenService.clearTokenCookies(response);
    this.tokenService.setTokenCookies(response, accessToken, refreshToken, true);

    await this.settingsService.updateUserSettings(userId, {
      isMFAEnabled: true,
    });

    return isValid;
  }

  async createMagicLink(email: string) {
    const user = await this.userService.getUserByEmail(email);

    if (user.archived) throw new UnauthorizedException("user.error.archived");

    const magicLinkToken = await this.createMagicLinkToken(user.id);

    if (!magicLinkToken) throw new InternalServerErrorException("magicLink.error.createToken");

    const defaultEmailSettings = await this.emailService.getDefaultEmailProperties(
      user.tenantId,
      user.id,
    );

    const magicLinkEmail = new MagicLinkEmail({
      magicLink: `${CORS_ORIGIN}/auth/login?token=${magicLinkToken}`,
      ...defaultEmailSettings,
    });

    const { html, text } = magicLinkEmail;

    await this.emailService.sendEmailWithLogo(
      {
        to: email,
        subject: getEmailSubject("magicLinkEmail", defaultEmailSettings.language),
        text,
        html,
      },
      { tenantId: user.tenantId },
    );
  }

  async handleMagicLinkLogin(response: Response, token: string) {
    const { MFAEnforcedRoles } = await this.settingsService.getGlobalSettings();

    const dateNow = new Date();

    const hashedToken = this.hashMagicLinkToken(token);

    const { user, accessToken, refreshToken } = await this.db.transaction(async (trx) => {
      const [magicLinkToken] = await trx
        .select()
        .from(magicLinkTokens)
        .where(eq(magicLinkTokens.token, hashedToken))
        .limit(1)
        .for("update");

      if (!magicLinkToken) throw new UnauthorizedException("magicLink.error.invalidToken");

      if (magicLinkToken.expiryDate < dateNow)
        throw new UnauthorizedException("magicLink.error.expiredToken");

      const user = await this.userService.getUserById(magicLinkToken.userId);

      if (user.archived) throw new UnauthorizedException("user.error.archived");

      await trx.delete(magicLinkTokens).where(eq(magicLinkTokens.id, magicLinkToken.id));

      const { refreshToken, accessToken } = await this.getTokens(user);

      return { user, accessToken, refreshToken };
    });

    const { id: userId, email, role } = user;

    const userSettings = await this.settingsService.getUserSettings(userId);
    const onboardingStatus = await this.userService.getAllOnboardingStatus(userId);

    await this.outboxPublisher.publish(
      new UserLoginEvent({
        userId,
        method: "magic_link",
        actor: { userId, email, role: role as UserRole, tenantId: user.tenantId },
      }),
    );

    const isManagingTenantAdmin = await this.isManagingTenantAdmin(user.tenantId, role as UserRole);

    if (MFAEnforcedRoles.includes(role as UserRole) || userSettings.isMFAEnabled) {
      this.tokenService.setTemporaryTokenCookies(response, accessToken, refreshToken);

      return {
        ...user,
        shouldVerifyMFA: true,
        onboardingStatus,
        isManagingTenantAdmin,
      };
    }

    this.tokenService.setTokenCookies(response, accessToken, refreshToken, true);

    return {
      ...user,
      shouldVerifyMFA: false,
      onboardingStatus,
      isManagingTenantAdmin,
    };
  }

  private async isManagingTenantAdmin(tenantId: UUIDType, role: UserRole): Promise<boolean> {
    if (role !== USER_ROLES.ADMIN) return false;

    const [tenant] = await this.db
      .select({ isManaging: tenants.isManaging })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    return Boolean(tenant?.isManaging);
  }

  async createMagicLinkToken(userId: UUIDType): Promise<string> {
    const token = nanoid(64);
    const hashedToken = this.hashMagicLinkToken(token);

    const expiryDate = new Date();
    expiryDate.setTime(expiryDate.getTime() + MAGIC_LINK_EXPIRATION_TIME);

    await this.db
      .insert(magicLinkTokens)
      .values({
        userId,
        token: hashedToken,
        expiryDate,
      })
      .returning();

    return token;
  }

  hashMagicLinkToken(token: string): string {
    return createHmac("sha256", this.ENCRYPTION_KEY).update(token, "utf8").digest("hex");
  }
}
