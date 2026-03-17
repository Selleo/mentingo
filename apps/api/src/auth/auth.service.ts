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
import {
  PERMISSIONS,
  SUPPORTED_LANGUAGES,
  SYSTEM_ROLE_SLUGS,
  type PermissionKey,
  type SupportedLanguages,
} from "@repo/shared";
import * as bcrypt from "bcryptjs";
import { and, eq, isNull, lt, lte, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { authenticator } from "otplib";

import { CORS_ORIGIN, MAGIC_LINK_EXPIRATION_TIME } from "src/auth/consts";
import { DatabasePg, type UUIDType } from "src/common";
import { EmailService } from "src/common/emails/emails.service";
import { getEmailSubject } from "src/common/emails/translations";
import { buildCreateNewPasswordLink } from "src/common/helpers/buildCreateNewPasswordLink";
import hashPassword from "src/common/helpers/hashPassword";
import { getSupportModeContext } from "src/common/helpers/support-mode-context";
import { UserLoginEvent } from "src/events/user/user-login.event";
import { UserPasswordCreatedEvent } from "src/events/user/user-password-created.event";
import { UserRegisteredEvent } from "src/events/user/user-registered.event";
import { UserWelcomeEvent } from "src/events/user/user-welcome.event";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { PermissionsService } from "src/permissions/permissions.service";
import { SettingsService } from "src/settings/settings.service";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { SupportModeService } from "src/support-mode/support-mode.service";

import {
  courseStudentMode,
  createTokens,
  credentials,
  formFieldAnswers,
  magicLinkTokens,
  resetTokens,
  userOnboarding,
  tenants,
  users,
} from "../storage/schema";
import { UserService } from "../user/user.service";

import { CreatePasswordService } from "./create-password.service";
import { ResetPasswordService } from "./reset-password.service";
import { TokenService } from "./token.service";

import type { CreatePasswordBody } from "./schemas/create-password.schema";
import type { RegisterUserWithHashedPasswordInput, TokenUser } from "./types";
import type { Response } from "express";
import type { ActorUserType } from "src/common/types/actor-user.type";
import type { CurrentUser } from "src/common/types/current-user.type";
import type { RegistrationFormField } from "src/settings/schemas/registration-form.schema";
import type { SupportSession } from "src/support-mode/support-mode.types";
import type { ProviderLoginUserType } from "src/utils/types/provider-login-user.type";

@Injectable()
export class AuthService {
  private readonly ENCRYPTION_KEY: Buffer;

  constructor(
    @Inject("DB") private readonly db: DatabasePg,
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
    @Inject(forwardRef(() => UserService)) private readonly userService: UserService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailService: EmailService,
    private createPasswordService: CreatePasswordService,
    private resetPasswordService: ResetPasswordService,
    private settingsService: SettingsService,
    private readonly outboxPublisher: OutboxPublisher,
    private tokenService: TokenService,
    private readonly supportModeService: SupportModeService,
    private readonly permissionsService: PermissionsService,
  ) {
    this.ENCRYPTION_KEY = Buffer.from(process.env.MASTER_KEY!, "base64");
  }

  public async register({
    email,
    firstName,
    lastName,
    password,
    language,
    formAnswers,
  }: {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    language: string;
    formAnswers?: Record<string, boolean>;
  }) {
    const [existingUser] = await this.dbAdmin
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email));

    if (existingUser) throw new ConflictException("registerView.toast.userAlreadyExists");

    const hashedPassword = await hashPassword(password);

    const registrationForm = await this.settingsService.getRegistrationForm();
    this.assertRegistrationAnswersAreValid(registrationForm.fields, formAnswers);

    const createdUser = await this.db.transaction(async (trx) => {
      const user = await this.createRegisteredUser(
        {
          email,
          firstName,
          lastName,
          language,
          hashedPassword,
        },
        trx,
      );

      const registrationAnswers = this.buildRegistrationAnswers(
        registrationForm.fields,
        formAnswers,
        language,
        user.id,
      );

      if (registrationAnswers.length) {
        await trx.insert(formFieldAnswers).values(registrationAnswers);
      }

      return user;
    });

    if (!createdUser) throw new BadRequestException("registerView.toast.createAccountFailed");

    await this.outboxPublisher.publish(
      new UserWelcomeEvent({
        email: createdUser.email,
        userId: createdUser.id,
        tenantId: createdUser.tenantId,
      }),
    );

    return createdUser;
  }

  private async createRegisteredUser(
    { email, firstName, lastName, language, hashedPassword }: RegisterUserWithHashedPasswordInput,
    dbInstance: DatabasePg = this.db,
  ) {
    const createdUser = await this.userService.createUser(
      {
        email,
        firstName,
        lastName,
        roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
        language,
      },
      dbInstance,
      undefined,
      { registration: { hashedPassword } },
    );

    const { avatarReference, ...userWithoutAvatar } = createdUser;

    const usersProfilePictureUrl =
      await this.userService.getUsersProfilePictureUrl(avatarReference);

    await this.outboxPublisher.publish(new UserRegisteredEvent(createdUser));

    return { ...userWithoutAvatar, profilePictureUrl: usersProfilePictureUrl };
  }

  private assertRegistrationAnswersAreValid(
    fields: RegistrationFormField[],
    formAnswers?: Record<string, boolean>,
  ) {
    const answers = formAnswers ?? {};
    const activeFieldIds = new Set(fields.map(({ id }) => id));

    for (const field of fields) {
      if (field.required && answers[field.id] !== true) {
        throw new BadRequestException("registerView.toast.requiredFormFieldMissing");
      }
    }

    for (const fieldId of Object.keys(answers)) {
      if (!activeFieldIds.has(fieldId)) {
        throw new BadRequestException("registerView.toast.invalidFormField");
      }
    }
  }

  private buildRegistrationAnswers(
    fields: RegistrationFormField[],
    formAnswers: Record<string, boolean> | undefined,
    language: string,
    userId: UUIDType,
  ) {
    if (!formAnswers) return [];

    return fields
      .filter((field) => Object.prototype.hasOwnProperty.call(formAnswers, field.id))
      .map((field) => ({
        formFieldId: field.id,
        userId,
        value: Boolean(formAnswers[field.id]),
        labelSnapshot: field.label,
        answeredLanguage: Object.values(SUPPORTED_LANGUAGES).includes(
          language as SupportedLanguages,
        )
          ? (language as SupportedLanguages)
          : SUPPORTED_LANGUAGES.EN,
      }));
  }

  public async login(data: { email: string; password: string }, MFAEnforcedRoles: string[]) {
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
    const { permissions, roleSlugs } = await this.permissionsService.getUserAccess(user.id);

    const onboardingStatus = await this.userService.getAllOnboardingStatus(user.id);
    const isManagingTenantAdmin = await this.isManagingTenantAdmin(user.tenantId, permissions);

    const actor: ActorUserType = {
      userId: user.id,
      email: user.email,
      roleSlugs,
      permissions,
      tenantId: user.tenantId,
    };

    await this.outboxPublisher.publish(
      new UserLoginEvent({ userId: user.id, method: "password", actor }),
    );

    if (this.isMfaRoleEnforced(MFAEnforcedRoles, roleSlugs) || userSettings.isMFAEnabled) {
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

  public async currentUser(currentUser: CurrentUser) {
    const { isSupportMode, dbInstance, sourceUserId, sourceTenantId } = getSupportModeContext(
      currentUser,
      this.db,
      this.dbAdmin,
    );

    if (isSupportMode) {
      return this.resolveSupportModeCurrentUser(
        currentUser,
        sourceUserId,
        sourceTenantId,
        dbInstance,
      );
    }

    const { userId, tenantId } = currentUser;

    const user = await this.userService.getUserById(userId);
    if (!user) throw new UnauthorizedException("User not found");

    const onboardingStatus = await this.getOnboardingStatus(userId);
    const { MFAEnforcedRoles } = await this.settingsService.getGlobalSettings();
    const userSettings = await this.settingsService.getUserSettings(userId);
    const { roleSlugs, permissions } = await this.permissionsService.getUserAccess(userId);

    const isManagingTenantAdmin = await this.isManagingTenantAdmin(tenantId, permissions);
    const studentModeCourseIds = await this.getStudentModeCourseIds(userId, this.db);

    if (this.isMfaRoleEnforced(MFAEnforcedRoles, roleSlugs) || userSettings.isMFAEnabled) {
      return {
        ...user,
        shouldVerifyMFA: true,
        onboardingStatus,
        isManagingTenantAdmin,
        isSupportMode: false,
        studentModeCourseIds,
        roleSlugs,
        permissions,
      };
    }

    return {
      ...user,
      shouldVerifyMFA: false,
      onboardingStatus,
      isManagingTenantAdmin,
      isSupportMode: false,
      studentModeCourseIds,
      roleSlugs,
      permissions,
    };
  }

  private async resolveSupportModeCurrentUser(
    currentUser: CurrentUser,
    sourceUserId: UUIDType,
    sourceTenantId: UUIDType,
    dbInstance: DatabasePg,
  ) {
    const { supportSessionId } = currentUser;

    if (!supportSessionId) throw new UnauthorizedException("Support session is invalid");

    const session = await this.supportModeService.assertActiveSession(supportSessionId);

    const user = await this.userService.getUserById(sourceUserId, dbInstance);
    const onboardingStatus = await this.getOnboardingStatus(sourceUserId, dbInstance);

    const supportPermissions = Object.values(PERMISSIONS) as PermissionKey[];

    const isManagingTenantAdmin = await this.isManagingTenantAdmin(
      sourceTenantId,
      supportPermissions,
    );
    const studentModeCourseIds = await this.getStudentModeCourseIds(sourceUserId, dbInstance);

    return {
      ...user,
      shouldVerifyMFA: false,
      onboardingStatus,
      isManagingTenantAdmin,
      isSupportMode: true,
      studentModeCourseIds,
      roleSlugs: [SYSTEM_ROLE_SLUGS.ADMIN],
      permissions: supportPermissions,
      supportContext: {
        ...session,
      },
    };
  }

  public async refreshTokens(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>("jwt.refreshSecret"),
        ignoreExpiration: false,
      });

      if (payload.isSupportMode && payload.supportSessionId) {
        const session = await this.supportModeService.assertActiveSession(payload.supportSessionId);

        const tokens = await this.getSupportTokensForSession(session);

        return tokens;
      }

      const user = await this.userService.getUserById(payload.userId);
      if (!user) {
        throw new UnauthorizedException("User not found");
      }

      const tokens = await this.getTokens(user);
      const { roleSlugs, permissions } = await this.permissionsService.getUserAccess(user.id);

      const actor: CurrentUser = {
        userId: user.id,
        email: user.email,
        roleSlugs,
        permissions,
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

  private async getStudentModeCourseIds(userId: UUIDType, dbInstance: DatabasePg) {
    const studentModeRecords = await dbInstance
      .select({ courseId: courseStudentMode.courseId })
      .from(courseStudentMode)
      .where(eq(courseStudentMode.userId, userId));

    return studentModeRecords.map(({ courseId }) => courseId);
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
    const { id: userId, email, tenantId } = user;
    const { permissions, roleSlugs } = await this.permissionsService.getUserAccess(userId);

    return this.signTokens({
      userId,
      email,
      tenantId,
      roleSlugs,
      permissions,
    });
  }

  async getSupportTokensForSession(session: SupportSession) {
    const now = Date.now();

    const sessionExpiresAtMs = new Date(session.expiresAt).getTime();
    const remainingSeconds = Math.floor((sessionExpiresAtMs - now) / 1000);

    if (remainingSeconds <= 0) throw new ForbiddenException("supportMode.errors.sessionExpired");

    const [originalUser] = await this.dbAdmin
      .select({ email: users.email })
      .from(users)
      .where(and(eq(users.id, session.originalUserId), isNull(users.deletedAt)))
      .limit(1);

    if (!originalUser) throw new UnauthorizedException("Support session is invalid");

    const supportPayload = {
      userId: session.originalUserId,
      email: originalUser.email,
      roleSlugs: [SYSTEM_ROLE_SLUGS.ADMIN],
      permissions: Object.values(PERMISSIONS) as PermissionKey[],
      tenantId: session.targetTenantId,
      isSupportMode: true,
      supportSessionId: session.id,
      supportExpiresAt: session.expiresAt,
      originalUserId: session.originalUserId,
      originalTenantId: session.originalTenantId,
      returnUrl: session.returnUrl,
    };

    return this.signTokens(supportPayload, `${remainingSeconds}s`, `${remainingSeconds}s`);
  }

  private async signTokens(
    payload: Record<string, unknown>,
    accessExpiresIn?: string,
    refreshExpiresIn: string = "7d",
  ) {
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        expiresIn: accessExpiresIn ?? this.configService.get<string>("jwt.expirationTime"),
        secret: this.configService.get<string>("jwt.secret"),
      }),
      this.jwtService.signAsync(payload, {
        expiresIn: refreshExpiresIn,
        secret: this.configService.get<string>("jwt.refreshSecret"),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  async createSupportModeTokens(grantToken: string) {
    const session = await this.supportModeService.consumeGrantToken(grantToken);

    const tokens = await this.getSupportTokensForSession(session);

    return { ...tokens, session };
  }

  async revokeSupportSession(sessionId: string) {
    await this.supportModeService.revokeSession(sessionId);
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

    const tenantOrigin = await this.resolveTenantOrigin(user.tenantId);

    const emailTemplate = new PasswordRecoveryEmail({
      name: user.firstName,
      resetLink: buildCreateNewPasswordLink(tenantOrigin, {
        resetToken,
        email,
      }),
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
    const { createToken: token, password, language, email } = data;
    const createToken = await this.createPasswordService.getOneByTokenAndEmail(token, email);

    const [existingUser] = await this.db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
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

    const { roleSlugs } = await this.permissionsService.getUserAccess(createToken.userId);

    await this.settingsService.createSettingsIfNotExists(createToken.userId, roleSlugs, {
      language: languageGuard,
    });

    await this.outboxPublisher.publish(new UserPasswordCreatedEvent({ ...existingUser }));

    return existingUser;
  }

  public async resetPassword(token: string, newPassword: string, email: string) {
    const resetToken = await this.resetPasswordService.getOneByTokenAndEmail(token, email);

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
      createPasswordLink: buildCreateNewPasswordLink(CORS_ORIGIN, {
        createToken,
        email,
      }),
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
        roleSlugs: [SYSTEM_ROLE_SLUGS.STUDENT],
      });
    }

    const tokens = await this.getTokens(user);
    const { roleSlugs, permissions } = await this.permissionsService.getUserAccess(user.id);

    const userSettings = await this.settingsService.getUserSettings(user.id);
    const { MFAEnforcedRoles } = await this.settingsService.getGlobalSettings();

    const actor: ActorUserType = {
      userId: user.id,
      email: user.email,
      roleSlugs,
      permissions,
      tenantId: user.tenantId,
    };

    await this.outboxPublisher.publish(
      new UserLoginEvent({ userId: user.id, method: "provider", actor }),
    );

    if (this.isMfaRoleEnforced(MFAEnforcedRoles, roleSlugs) || userSettings.isMFAEnabled) {
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

    const { id: userId, email } = user;
    const { roleSlugs, permissions } = await this.permissionsService.getUserAccess(userId);

    const userSettings = await this.settingsService.getUserSettings(userId);
    const onboardingStatus = await this.userService.getAllOnboardingStatus(userId);

    await this.outboxPublisher.publish(
      new UserLoginEvent({
        userId,
        method: "magic_link",
        actor: {
          userId,
          email,
          roleSlugs,
          permissions,
          tenantId: user.tenantId,
        },
      }),
    );

    const isManagingTenantAdmin = await this.isManagingTenantAdmin(user.tenantId, permissions);

    if (this.isMfaRoleEnforced(MFAEnforcedRoles, roleSlugs) || userSettings.isMFAEnabled) {
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

  private async isManagingTenantAdmin(
    tenantId: UUIDType,
    permissions: PermissionKey[],
  ): Promise<boolean> {
    if (!permissions.includes(PERMISSIONS.TENANT_MANAGE)) return false;

    const [tenant] = await this.db
      .select({ isManaging: tenants.isManaging })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    return Boolean(tenant?.isManaging);
  }

  private isMfaRoleEnforced(enforcedRoles: string[], roleSlugs: string[]): boolean {
    if (!enforcedRoles.length || !roleSlugs.length) return false;

    return roleSlugs.some((roleSlug) => enforcedRoles.includes(roleSlug));
  }

  private async getOnboardingStatus(userId: UUIDType, db?: DatabasePg) {
    const dbInstance = db ?? this.db;

    const [onboardingStatus] = await dbInstance
      .select()
      .from(userOnboarding)
      .where(eq(userOnboarding.userId, userId))
      .limit(1);

    return onboardingStatus;
  }

  private async resolveTenantOrigin(tenantId: UUIDType): Promise<string> {
    const [tenant] = await this.dbAdmin
      .select({ host: tenants.host })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    return tenant?.host || CORS_ORIGIN;
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
