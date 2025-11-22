import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { LANGUAGES, SUPPORTED_LANGUAGES } from "src/ai/utils/ai.type";
import { SettingsService } from "src/settings/settings.service";

import { EmailAdapter } from "./adapters/email.adapter";

import type { Attachment, Email } from "./email.interface";
import type { Languages } from "src/ai/utils/ai.type";
import type { UUIDType } from "src/common";
import type { EmailConfigSchema } from "src/common/configuration/email";
import type { DefaultEmailSettings } from "src/events/types";

@Injectable()
export class EmailService {
  private readonly usingMailhogAdapter: boolean;

  constructor(
    private emailAdapter: EmailAdapter,
    private settingsService: SettingsService,
    private configService: ConfigService,
  ) {
    this.usingMailhogAdapter =
      this.configService.get<EmailConfigSchema["EMAIL_ADAPTER"]>("email.EMAIL_ADAPTER") ===
      "mailhog";
  }

  async sendEmail(email: Email): Promise<void> {
    await this.emailAdapter.sendMail(email);
  }

  async sendEmailWithLogo(email: Omit<Email, "attachments">): Promise<void> {
    const logoBuffer = await this.settingsService.getPlatformLogoBuffer();
    const simpleLogoBuffer = await this.settingsService.getPlatformSimpleLogoBuffer();
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

    if (simpleLogoBuffer) {
      attachments.push({
        filename: "simple-logo.png",
        content: simpleLogoBuffer,
        contentType: "image/png",
        ...(this.usingMailhogAdapter ? {} : { cid: "simple-logo" }),
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
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  }

  async getDefaultEmailProperties(userId?: UUIDType): Promise<DefaultEmailSettings> {
    const globalSettings = await this.settingsService.getGlobalSettings();

    return {
      primaryColor: globalSettings.primaryColor || "#4796FD",
      language: userId ? await this.getFinalLanguage(userId) : LANGUAGES.EN,
    };
  }

  async getFinalLanguage(userId: UUIDType): Promise<Languages> {
    const userSettings = await this.settingsService.getUserSettings(userId);
    const language = userSettings.language as Languages;

    return Object.values(SUPPORTED_LANGUAGES).includes(language) ? language : LANGUAGES.EN;
  }
}
