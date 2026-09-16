import { Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { sql } from "drizzle-orm";
import sharp from "sharp";

import { DatabasePg } from "src/common";
import { EmailTemplateRenderingService } from "src/email-templates/services/email-template-rendering.service";
import { SettingsService } from "src/settings/settings.service";
import { DB_ADMIN } from "src/storage/db/db.providers";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { EmailAdapter } from "./adapters/email.adapter";

import type { Attachment, Email } from "./email.interface";
import type { SupportedLanguages } from "@repo/shared";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { UUIDType } from "src/common";
import type { EmailConfigSchema } from "src/common/configuration/email";
import type { EmailTemplateSendOptions } from "src/email-templates/email-template.types";
import type { DefaultEmailSettings } from "src/events/types";

@Injectable()
export class EmailService {
  private readonly fromEmail: string;

  constructor(
    @Inject(DB_ADMIN) private readonly dbAdmin: DatabasePg,
    private emailAdapter: EmailAdapter,
    private settingsService: SettingsService,
    private readonly tenantRunner: TenantDbRunnerService,
    private configService: ConfigService,
    private readonly emailTemplateRenderingService: EmailTemplateRenderingService,
  ) {
    this.fromEmail = this.configService.get<EmailConfigSchema["SMTP_EMAIL_FROM"]>(
      "email.SMTP_EMAIL_FROM",
    ) as string;
  }

  async sendEmail(email: Email): Promise<void> {
    await this.emailAdapter.sendMail({ ...email, from: this.fromEmail });
  }

  async sendEmailWithLogo(
    email: Omit<Email, "from">,
    options: EmailTemplateSendOptions,
  ): Promise<void> {
    const { logoBuffer, borderCircleBuffer } = await this.tenantRunner.runWithTenant(
      options.tenantId,
      async () => ({
        logoBuffer: await this.settingsService.getPlatformLogoBuffer(),
        borderCircleBuffer: await this.settingsService.getEmailBorderCircleBuffer(),
      }),
    );

    const branding = options.template
      ? await this.getDefaultEmailProperties(options.tenantId, undefined, options.template.language)
      : undefined;
    const customTemplate =
      options.template && branding
        ? await this.emailTemplateRenderingService.renderPublishedEmailTemplate(
            options.tenantId,
            options.template,
            {
              ...branding,
              logoUrl: logoBuffer ? "cid:logo" : undefined,
              borderCircleUrl: borderCircleBuffer ? "cid:border-circle" : undefined,
            },
          )
        : undefined;
    const attachments: Attachment[] = [
      ...(email.attachments ?? []),
      ...(customTemplate?.attachments ?? []),
    ];

    if (logoBuffer) {
      attachments.push({
        filename: "logo.png",
        content: logoBuffer,
        contentType: "image/png",
        cid: "logo",
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

    const payload = {
      ...(email as Email),
      ...(customTemplate
        ? { subject: customTemplate.subject, html: customTemplate.html, text: customTemplate.text }
        : {}),
      from: this.fromEmail,
      attachments: attachments.length > 0 ? attachments : undefined,
    };
    await this.emailAdapter.sendMail(payload);
  }

  async getEmailPreviewLogo(tenantId: UUIDType): Promise<string | undefined> {
    return this.tenantRunner.runWithTenant(tenantId, async () => {
      const logo = await this.settingsService.getPlatformLogoBuffer();
      if (!logo) return undefined;
      const previewLogo = await sharp(logo).resize({ height: 64 }).png().toBuffer();
      return `data:image/png;base64,${previewLogo.toString("base64")}`;
    });
  }

  async getEmailPreviewBorderCircle(tenantId: UUIDType): Promise<string | undefined> {
    return this.tenantRunner.runWithTenant(tenantId, async () => {
      const borderCircle = await this.settingsService.getEmailBorderCircleBuffer();
      return borderCircle ? `data:image/png;base64,${borderCircle.toString("base64")}` : undefined;
    });
  }

  async getDefaultEmailProperties(
    tenantId: UUIDType,
    userId?: UUIDType,
    language?: SupportedLanguages,
  ): Promise<DefaultEmailSettings> {
    return this.tenantRunner.runWithTenant(tenantId, async () => {
      const globalSettings = await this.settingsService.getGlobalSettings();
      const companyName = globalSettings.companyInformation?.companyName || "Mentingo.com";

      return {
        primaryColor: globalSettings.primaryColor || "#4796FD",
        companyName,
        language:
          language ?? (userId ? await this.getFinalLanguage(userId) : SUPPORTED_LANGUAGES.EN),
      };
    });
  }

  getDefaultEmailPropertiesSql(userSettingsColumn: AnyPgColumn, globalSettingsColumn: AnyPgColumn) {
    return sql<DefaultEmailSettings>`
      jsonb_build_object(
        'language',
        ${userSettingsColumn}->>'language',
        'primaryColor',
        COALESCE(NULLIF(${globalSettingsColumn}->>'primaryColor', ''), '#4796FD'),
        'companyName',
        COALESCE(NULLIF(${globalSettingsColumn} #>> '{companyInformation,companyName}', ''), 'Mentingo.com')
      )
    `;
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
