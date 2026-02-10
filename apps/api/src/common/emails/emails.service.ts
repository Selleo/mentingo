import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { SettingsService } from "src/settings/settings.service";

import { EmailAdapter } from "./adapters/email.adapter";

import type { Attachment, Email } from "./email.interface";
import type { SupportedLanguages } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";
import type { EmailConfigSchema } from "src/common/configuration/email";
import type { DefaultEmailSettings } from "src/events/types";

@Injectable()
export class EmailService {
  private readonly usingMailhogAdapter: boolean;
  private readonly fromEmail: string;

  constructor(
    private emailAdapter: EmailAdapter,
    private settingsService: SettingsService,
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

  async sendEmailWithLogo(email: Omit<Email, "from" | "attachments">): Promise<void> {
    const logoBuffer = await this.settingsService.getPlatformLogoBuffer();
    const borderCircleBuffer = await this.settingsService.getEmailBorderCircleBuffer();

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

    await this.emailAdapter.sendMail({
      ...(email as Email),
      from: this.fromEmail,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  }

  async getDefaultEmailProperties(
    userId?: UUIDType,
    dbInstance?: DatabasePg,
  ): Promise<DefaultEmailSettings> {
    const globalSettings = await this.settingsService.getGlobalSettings();

    return {
      primaryColor: globalSettings.primaryColor || "#4796FD",
      language: userId ? await this.getFinalLanguage(userId, dbInstance) : SUPPORTED_LANGUAGES.EN,
    };
  }

  async getFinalLanguage(userId: UUIDType, dbInstance?: DatabasePg): Promise<SupportedLanguages> {
    const userSettings = await this.settingsService.getUserSettings(userId, dbInstance);
    const language = userSettings.language as SupportedLanguages;

    return Object.values(SUPPORTED_LANGUAGES).includes(language)
      ? language
      : SUPPORTED_LANGUAGES.EN;
  }
}
