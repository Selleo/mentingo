import { Injectable, NotFoundException } from "@nestjs/common";
import {
  deriveEmailTemplatePublicationUsage,
  getBuiltInTemplatePublication,
  renderEmailTemplate,
  type PublishedEmailTemplate,
  type EmailTemplateBranding,
  type EmailTemplateVariableValue,
} from "@repo/email-templates";

import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { EmailTemplateRepository } from "../repositories/email-template.repository";

import { EmailTemplateAssetService } from "./email-template-asset.service";
import { EmailTemplateValidationService } from "./email-template-validation.service";

import type { MappedTemplateRenderOptions } from "../email-template.types";
import type {
  AutomationTemplateReference,
  AutomationPlaceholderValue,
  SupportedLanguages,
} from "@repo/shared";
import type { UUIDType } from "src/common";

@Injectable()
export class EmailTemplateRenderingService {
  constructor(
    private readonly emailTemplateRepository: EmailTemplateRepository,
    private readonly emailTemplateValidationService: EmailTemplateValidationService,
    private readonly emailTemplateAssetService: EmailTemplateAssetService,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  async getPublishedEmailTemplate(
    reference: AutomationTemplateReference,
  ): Promise<PublishedEmailTemplate> {
    if (reference.type === "builtin") {
      return getBuiltInTemplatePublication(reference.key);
    }

    const template = await this.emailTemplateRepository.findEmailTemplateById(
      reference.id as UUIDType,
    );

    if (!template || template.status !== "published" || !template.publication) {
      throw new NotFoundException("emailTemplates.errors.notPublished");
    }

    return deriveEmailTemplatePublicationUsage(template.publication);
  }

  async renderMappedEmailTemplate(
    tenantId: UUIDType,
    reference: AutomationTemplateReference,
    language: SupportedLanguages,
    variables: Record<string, AutomationPlaceholderValue>,
    branding: EmailTemplateBranding,
    options: MappedTemplateRenderOptions = {},
  ) {
    return this.tenantDbRunnerService.runWithTenant(tenantId, async () => {
      const publication = await this.getPublishedEmailTemplate(reference);

      return this.renderEmailTemplatePublication(
        tenantId,
        publication,
        language,
        variables,
        branding,
        options,
      );
    });
  }

  /** Caller captures the current publication under its atomic send claim. */
  async renderEmailTemplatePublication(
    tenantId: UUIDType,
    publication: PublishedEmailTemplate,
    requestedLanguage: SupportedLanguages,
    values: Record<string, AutomationPlaceholderValue>,
    branding: EmailTemplateBranding,
    options: MappedTemplateRenderOptions = {},
  ) {
    const language = this.emailTemplateValidationService.resolveEmailTemplateLanguage(
      publication.subject,
      publication.content,
      requestedLanguage,
      publication.baseLanguage,
    );

    const variables = this.resolveEmailTemplateVariables(
      publication,
      values,
      language,
      branding.companyName,
    );

    const document = publication.content[language]!;
    const subject = publication.subject[language]!;

    this.emailTemplateValidationService.assertEmailTemplateVariableValues(
      publication.placeholders,
      document,
      variables,
      subject,
    );
    this.emailTemplateValidationService.assertSafeAccountActionLinks(
      subject,
      document,
      options.sensitivePlaceholderKeys ?? [],
    );

    const resolved = await this.emailTemplateAssetService.resolveEmailTemplateAssets(
      document,
      tenantId,
      options.preview ?? false,
    );

    return {
      ...renderEmailTemplate({
        document: resolved.document,
        subject,
        language,
        variables,
        branding,
      }),
      language,
      attachments: resolved.attachments,
    };
  }

  private resolveEmailTemplateVariables(
    publication: PublishedEmailTemplate,
    providedValues: Record<string, AutomationPlaceholderValue>,
    language: SupportedLanguages,
    companyName: string,
  ): Record<string, EmailTemplateVariableValue> {
    const variables: Record<string, EmailTemplateVariableValue> = { company_name: companyName };

    for (const placeholder of publication.placeholders) {
      const value = providedValues[placeholder.name];

      if (value === undefined || value === null) {
        continue;
      }

      const isLocalizedValue =
        placeholder.type === "localized_string" &&
        typeof value === "object" &&
        !Array.isArray(value);

      if (!isLocalizedValue) {
        variables[placeholder.name] = value as EmailTemplateVariableValue;
        continue;
      }

      const localizedValue = value[language] ?? value[publication.baseLanguage];

      if (typeof localizedValue === "string") {
        variables[placeholder.name] = localizedValue;
      }
    }

    return variables;
  }
}
