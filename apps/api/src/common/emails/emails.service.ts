import { Injectable } from "@nestjs/common";

import { SettingsService } from "src/settings/settings.service";

import { EmailAdapter } from "./adapters/email.adapter";

import type { Email } from "./email.interface";
import type { DefaultEmailSettings } from "src/events/types";

@Injectable()
export class EmailService {
  constructor(
    private emailAdapter: EmailAdapter,
    private settingsService: SettingsService,
  ) {}

  async sendEmail(email: Email): Promise<void> {
    await this.emailAdapter.sendMail(email);
  }

  async sendEmailWithLogo(email: Omit<Email, "attachments">): Promise<void> {
    const logoBuffer = await this.settingsService.getPlatformLogoBuffer();
    const simpleLogoBuffer = await this.settingsService.getPlatformSimpleLogoBuffer();
    const borderCircleBuffer = await this.settingsService.getEmailBorderCircleBuffer();

    const attachments = [];

    if (logoBuffer) {
      attachments.push({
        filename: "logo.png",
        content: logoBuffer,
        contentType: "image/png",
        cid: "logo",
      });
    }

    if (simpleLogoBuffer) {
      attachments.push({
        filename: "simple-logo.png",
        content: simpleLogoBuffer,
        contentType: "image/png",
        cid: "simple-logo",
      });
    }

    if (borderCircleBuffer) {
      attachments.push({
        filename: "border-circle.png",
        content: borderCircleBuffer,
        contentType: "image/png",
        cid: "border-circle",
      });
    }

    await this.emailAdapter.sendMail({
      ...(email as Email),
      attachments: attachments.length > 0 ? attachments : undefined,
    });
  }

  async getDefaultEmailProperties(): Promise<DefaultEmailSettings> {
    const globalSettings = await this.settingsService.getGlobalSettings();

    return {
      primaryColor: globalSettings.primaryColor || "#4796FD",
    };
  }
}
