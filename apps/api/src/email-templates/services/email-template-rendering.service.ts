import { Injectable } from "@nestjs/common";
import { renderEmailTemplate } from "@repo/email-templates";

import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { EmailTemplateRepository } from "../repositories/email-template.repository";

import { EmailTemplateAssetService } from "./email-template-asset.service";
import { EmailTemplateValidationService } from "./email-template-validation.service";

import type { EmailTemplateDeliveryContext } from "../email-template.types";
import type { UUIDType } from "src/common";
import type { DefaultEmailSettings } from "src/events/types";

@Injectable()
export class EmailTemplateRenderingService {
  constructor(
    private readonly emailTemplateRepository: EmailTemplateRepository,
    private readonly emailTemplateValidationService: EmailTemplateValidationService,
    private readonly emailTemplateAssetService: EmailTemplateAssetService,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {}

  async renderPublishedEmailTemplate(
    tenantId: UUIDType,
    context: EmailTemplateDeliveryContext,
    branding: DefaultEmailSettings & { logoUrl?: string; borderCircleUrl?: string },
  ) {
    return this.tenantRunner.runWithTenant(tenantId, async () => {
      const template = await this.emailTemplateRepository.findPublishedEmailTemplate(context.event);
      if (!template) return undefined;

      const language = this.emailTemplateValidationService.resolveEmailTemplateLanguage(
        template.subject,
        template.content,
        context.language,
        template.baseLanguage,
      );
      const document = template.content[language]!;
      const variables = { ...context.variables, company_name: branding.companyName };
      this.emailTemplateValidationService.validateRuntimeVariables(
        context.event,
        document,
        variables,
        template.subject[language]!,
      );
      const resolved = await this.emailTemplateAssetService.resolveEmailTemplateAssets(
        document,
        tenantId,
      );
      return {
        ...renderEmailTemplate({
          event: context.event,
          document: resolved.document,
          subject: template.subject[language]!,
          language,
          variables,
          branding,
        }),
        attachments: resolved.attachments,
      };
    });
  }
}
