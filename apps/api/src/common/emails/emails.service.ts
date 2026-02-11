import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { DatabasePg } from "src/common";
import { SettingsService } from "src/settings/settings.service";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { EmailAdapter } from "./adapters/email.adapter";

import type { Attachment, Email } from "./email.interface";
import type { SupportedLanguages } from "@repo/shared";
import type { UUIDType } from "src/common";
import type { EmailConfigSchema } from "src/common/configuration/email";
import type { DefaultEmailSettings } from "src/events/types";

@Injectable()
export class EmailService {
  private readonly usingMailhogAdapter: boolean;
  private readonly fromEmail: string;

  constructor(
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
    private emailAdapter: EmailAdapter,
    private settingsService: SettingsService,
    private readonly tenantRunner: TenantDbRunnerService,
    private configService: ConfigService,
  ) {
    this.usingMailhogAdapter =
      this.configService.get<EmailConfigSchema["EMAIL_ADAPTER"]>("email.EMAIL_ADAPTER") ===
      "mailhog";

    this.fromEmail = this.configService.get<EmailConfigSchema["SMTP_EMAIL_FROM"]>(
      "email.SMTP_EMAIL_FROM",
    ) as string;
  }

  async sendEmail(email: Email): Promise<void> {
    await this.emailAdapter.sendMail({ ...email, from: this.fromEmail });
  }

  async sendEmailWithLogo(
    email: Omit<Email, "from" | "attachments">,
    options: { tenantId: UUIDType },
  ): Promise<void> {
    const { logoBuffer, borderCircleBuffer } = await this.tenantRunner.runWithTenant(
      options.tenantId,
      async () => ({
        logoBuffer: await this.settingsService.getPlatformLogoBuffer(),
        borderCircleBuffer: await this.settingsService.getEmailBorderCircleBuffer(),
      }),
    );

    const attachments: Attachment[] = [];

    if (logoBuffer) {
      attachments.push({
        filename: "logo.png",
        content: logoBuffer,
        contentType: "image/png",
        ...(this.usingMailhogAdapter ? {} : { cid: "logo" }),
      });
    }

    if (borderCircleBuffer) {
      attachments.push({
        filename: "border-circle.png",
        content: borderCircleBuffer,
        contentType: "image/png",
        ...(this.usingMailhogAdapter ? {} : { cid: "border-circle" }),
      });
    }

    const payload = {
      ...(email as Email),
      from: this.fromEmail,
      attachments: attachments.length > 0 ? attachments : undefined,
    };
    await this.emailAdapter.sendMail(payload);
  }

  async getDefaultEmailProperties(
    tenantId: UUIDType,
    userId?: UUIDType,
  ): Promise<DefaultEmailSettings> {
    return this.tenantRunner.runWithTenant(tenantId, async () => {
      const globalSettings = await this.settingsService.getGlobalSettings();

      return {
        primaryColor: globalSettings.primaryColor || "#4796FD",
        language: userId ? await this.getFinalLanguage(userId) : SUPPORTED_LANGUAGES.EN,
      };
    });
  }

  async getFinalLanguage(userId: UUIDType, dbInstance?: DatabasePg): Promise<SupportedLanguages> {
    const userSettings = await this.settingsService.getUserSettings(
      userId,
      dbInstance ?? this.dbAdmin,
    );
    const language = userSettings.language as SupportedLanguages;

    return Object.values(SUPPORTED_LANGUAGES).includes(language)
      ? language
      : SUPPORTED_LANGUAGES.EN;
  }
}
