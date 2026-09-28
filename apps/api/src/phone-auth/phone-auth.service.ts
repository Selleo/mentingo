import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { and, eq, isNull, ne, sql } from "drizzle-orm";

import { AuthService } from "src/auth/auth.service";
import { DatabasePg, type UUIDType } from "src/common";
import { SettingsService } from "src/settings/settings.service";
import { dbAls } from "src/storage/db/db-als.store";
import { DB } from "src/storage/db/db.providers";
import { users } from "src/storage/schema";

import { readPhoneAuthConfig } from "./phone-auth.config";
import {
  PHONE_AUTH_ERRORS,
  PHONE_AUTH_MESSAGES,
  PHONE_OTP_PURPOSE,
  PHONE_OTP_RESEND_COOLDOWN_SECONDS,
  PHONE_OTP_TTL_SECONDS,
  SMS_PROVIDER,
} from "./phone-auth.constants";
import { buildOtpSmsText } from "./phone-auth.messages";
import { SmsProvider } from "./phone-auth.types";
import { PhoneOtpService } from "./phone-otp.service";
import { maskPhone, normalizePhone } from "./phone.utils";

import type { PhoneOtpContext } from "./phone-auth.types";
import type {
  RequestPhoneCodeResponse,
  UserPhoneResponse,
  VerifyPhoneAttachBody,
  VerifyPhoneLoginBody,
} from "./schemas/phone-auth.schema";
import type { Response } from "express";
import type { LoginResponse } from "src/auth/schemas/login.schema";
import type { CurrentUserType } from "src/common/types/current-user.type";

const UNIQUE_VIOLATION_CODE = "23505";

@Injectable()
export class PhoneAuthService {
  private readonly logger = new Logger(PhoneAuthService.name);

  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    @Inject(SMS_PROVIDER) private readonly smsProvider: SmsProvider,
    private readonly otpService: PhoneOtpService,
    private readonly authService: AuthService,
    private readonly settingsService: SettingsService,
  ) {}

  isEnabled(): boolean {
    return readPhoneAuthConfig().enabled;
  }

  /**
   * Public login step 1. Always answers with the same payload whether or not the number
   * belongs to a user of this tenant, so the endpoint cannot be used to enumerate users.
   * Throttling is applied before the lookup for the same reason.
   */
  async requestLoginCode(rawPhone: string): Promise<RequestPhoneCodeResponse> {
    await this.assertLoginAllowed();

    const phone = this.normalizeOrThrow(rawPhone);
    const tenantId = this.getRequestTenantId();

    await this.otpService.reserveSendSlot(phone);

    const user = await this.findActiveUserByPhone(phone);

    if (user && !user.archived) {
      const context: PhoneOtpContext = { tenantId, purpose: PHONE_OTP_PURPOSE.LOGIN, phone };
      const code = await this.otpService.issue(context);
      const language = await this.getUserLanguage(user.id);

      // Not awaited: response time must not depend on whether an SMS was actually sent.
      void this.sendCode(context, code, language).catch(() => undefined);
    } else {
      this.logger.log(`Login code requested for unknown phone ${maskPhone(phone)}`);
    }

    return this.buildCodeSentResponse();
  }

  /** Public login step 2: verifies the code and issues the regular session (or the MFA step). */
  async verifyLoginCode(
    { phone: rawPhone, code, rememberMe }: VerifyPhoneLoginBody,
    response: Response,
  ): Promise<LoginResponse> {
    await this.assertLoginAllowed();

    const phone = this.normalizeOrThrow(rawPhone);
    const tenantId = this.getRequestTenantId();

    await this.otpService.verify({ tenantId, purpose: PHONE_OTP_PURPOSE.LOGIN, phone }, code);

    const user = await this.findActiveUserByPhone(phone);

    if (!user) throw new UnauthorizedException(PHONE_AUTH_ERRORS.INVALID_OR_EXPIRED_CODE);
    if (user.archived) throw new UnauthorizedException("user.error.archived");

    if (!user.phoneVerifiedAt) {
      await this.db
        .update(users)
        .set({ phoneVerifiedAt: sql`NOW()` })
        .where(and(eq(users.id, user.id), isNull(users.phoneVerifiedAt)));
    }

    return this.authService.loginWithVerifiedPhone(response, user.id, rememberMe ?? false);
  }

  /** Authenticated: sends a code to a new number the user wants to attach to their account. */
  async requestAttachCode(
    currentUser: CurrentUserType,
    rawPhone: string,
  ): Promise<RequestPhoneCodeResponse> {
    this.assertEnabled();

    const phone = this.normalizeOrThrow(rawPhone);
    const user = await this.getCurrentUserPhone(currentUser.userId);

    if (user.phone === phone && user.phoneVerifiedAt) {
      throw new BadRequestException(PHONE_AUTH_ERRORS.PHONE_ALREADY_VERIFIED);
    }

    await this.assertPhoneNotTaken(phone, currentUser.userId);
    await this.otpService.reserveSendSlot(phone);

    const context = this.getAttachContext(currentUser, phone);
    const code = await this.otpService.issue(context);
    const language = await this.getUserLanguage(currentUser.userId);

    try {
      await this.sendCode(context, code, language);
    } catch {
      await this.otpService.invalidate(context);
      await this.otpService.releaseCooldown(phone);
      throw new ServiceUnavailableException(PHONE_AUTH_ERRORS.SMS_SEND_FAILED);
    }

    return this.buildCodeSentResponse();
  }

  /** Authenticated: verifies the code and stores the number as the user's verified phone. */
  async verifyAttachCode(
    currentUser: CurrentUserType,
    { phone: rawPhone, code }: VerifyPhoneAttachBody,
  ): Promise<UserPhoneResponse> {
    this.assertEnabled();

    const phone = this.normalizeOrThrow(rawPhone);

    await this.otpService.verify(this.getAttachContext(currentUser, phone), code);
    await this.assertPhoneNotTaken(phone, currentUser.userId);

    try {
      const [updated] = await this.db
        .update(users)
        .set({ phone, phoneVerifiedAt: sql`NOW()` })
        .where(and(eq(users.id, currentUser.userId), isNull(users.deletedAt)))
        .returning({ phone: users.phone, phoneVerifiedAt: users.phoneVerifiedAt });

      if (!updated) throw new NotFoundException("adminUserView.error.userNotFound");

      this.logger.log(`User ${currentUser.userId} verified phone ${maskPhone(phone)}`);

      return updated;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(PHONE_AUTH_ERRORS.PHONE_TAKEN);
      }

      throw error;
    }
  }

  /** Authenticated: detaches the phone from the current user's account. */
  async removeOwnPhone(currentUser: CurrentUserType): Promise<UserPhoneResponse> {
    this.assertEnabled();

    const [updated] = await this.db
      .update(users)
      .set({ phone: null, phoneVerifiedAt: null })
      .where(and(eq(users.id, currentUser.userId), isNull(users.deletedAt)))
      .returning({ phone: users.phone, phoneVerifiedAt: users.phoneVerifiedAt });

    if (!updated) throw new NotFoundException("adminUserView.error.userNotFound");

    return updated;
  }

  private async sendCode(context: PhoneOtpContext, code: string, language?: string | null) {
    const maskedPhone = maskPhone(context.phone);

    try {
      await this.smsProvider.send({
        to: context.phone,
        text: buildOtpSmsText(context.purpose, code, language),
      });

      this.logger.log(
        `Sent ${context.purpose} code to ${maskedPhone} via ${this.smsProvider.name}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send ${context.purpose} code to ${maskedPhone} via ${this.smsProvider.name}: ${
          (error as Error)?.message ?? "unknown error"
        }`,
      );

      throw error;
    }
  }

  private buildCodeSentResponse(): RequestPhoneCodeResponse {
    return {
      message: PHONE_AUTH_MESSAGES.CODE_SENT,
      resendAvailableInSeconds: PHONE_OTP_RESEND_COOLDOWN_SECONDS,
      codeTtlSeconds: PHONE_OTP_TTL_SECONDS,
    };
  }

  private assertEnabled() {
    if (!this.isEnabled()) throw new ForbiddenException(PHONE_AUTH_ERRORS.DISABLED);
  }

  private async assertLoginAllowed() {
    this.assertEnabled();

    const { enforceSSO } = await this.settingsService.getGlobalSettings();

    if (enforceSSO) throw new UnauthorizedException(PHONE_AUTH_ERRORS.SSO_ENFORCED);
  }

  private normalizeOrThrow(rawPhone: string): string {
    const phone = normalizePhone(rawPhone);

    if (!phone) throw new BadRequestException(PHONE_AUTH_ERRORS.INVALID_PHONE);

    return phone;
  }

  private getRequestTenantId(): string {
    const tenantId = dbAls.getStore()?.tenantId;

    if (!tenantId) throw new UnauthorizedException("Missing tenantId");

    return tenantId;
  }

  private getAttachContext(currentUser: CurrentUserType, phone: string): PhoneOtpContext {
    return {
      tenantId: currentUser.tenantId,
      purpose: PHONE_OTP_PURPOSE.ATTACH,
      subjectId: currentUser.userId,
      phone,
    };
  }

  private async findActiveUserByPhone(phone: string) {
    const [user] = await this.db
      .select({
        id: users.id,
        archived: users.archived,
        phoneVerifiedAt: users.phoneVerifiedAt,
      })
      .from(users)
      .where(and(eq(users.phone, phone), isNull(users.deletedAt)))
      .limit(1);

    return user;
  }

  private async getCurrentUserPhone(userId: UUIDType) {
    const [user] = await this.db
      .select({ phone: users.phone, phoneVerifiedAt: users.phoneVerifiedAt })
      .from(users)
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .limit(1);

    if (!user) throw new NotFoundException("adminUserView.error.userNotFound");

    return user;
  }

  private async assertPhoneNotTaken(phone: string, userId: UUIDType) {
    const [owner] = await this.db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.phone, phone), ne(users.id, userId)))
      .limit(1);

    if (owner) throw new ConflictException(PHONE_AUTH_ERRORS.PHONE_TAKEN);
  }

  private async getUserLanguage(userId: UUIDType): Promise<string | null> {
    try {
      const { language } = await this.settingsService.getUserSettings(userId);
      return language ?? null;
    } catch {
      return null;
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    const code =
      (error as { code?: string })?.code ?? (error as { cause?: { code?: string } })?.cause?.code;

    return code === UNIQUE_VIOLATION_CODE;
  }
}
