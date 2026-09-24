import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  EMAIL_TEMPLATE_DEFINITIONS,
  EMAIL_TEMPLATE_STATUSES,
  EMAIL_TEMPLATE_SYSTEM_VARIABLES,
  renderEmailTemplate,
  type EmailTemplateDefinition,
  type EmailTemplateEvent,
  type LocalizedEmailTemplateContent,
} from "@repo/email-templates";
import { SUPPORTED_LANGUAGES, type LocalizedText, type SupportedLanguages } from "@repo/shared";

import { EmailService } from "src/common/emails/emails.service";
import { DEFAULT_PAGE_SIZE } from "src/common/pagination";

import { EmailTemplateRepository } from "../repositories/email-template.repository";

import { EmailTemplateAssetService } from "./email-template-asset.service";
import { EmailTemplateValidationService } from "./email-template-validation.service";

import type { EmailTemplateRecord } from "../email-template.types";
import type {
  CreateEmailTemplateBody,
  EmailTemplatePreviewResponse,
  EmailTemplateResponse,
  PreviewEmailTemplateBody,
  UpdateEmailTemplateBaseLanguageBody,
  UpdateEmailTemplateBody,
} from "../schemas/email-template.schema";
import type { UUIDType } from "src/common";

@Injectable()
export class EmailTemplateService {
  constructor(
    private readonly emailTemplateRepository: EmailTemplateRepository,
    private readonly emailTemplateValidationService: EmailTemplateValidationService,
    private readonly emailService: EmailService,
    private readonly emailTemplateAssetService: EmailTemplateAssetService,
  ) {}

  async getEmailTemplates(page = 1, perPage = DEFAULT_PAGE_SIZE) {
    const offset = (page - 1) * perPage;
    const { templates: overrides, totalItems: overrideCount } =
      await this.emailTemplateRepository.findEmailTemplateOverridePageWithTotal(offset, perPage);
    const overrideTemplates = overrides.map((template) => this.mapOverrideTemplate(template));
    const defaultTemplates = this.getDefaultEmailTemplatesForPage(offset, perPage, overrideCount);

    return {
      data: [...overrideTemplates, ...defaultTemplates],
      pagination: { totalItems: overrideCount + EMAIL_TEMPLATE_DEFINITIONS.length, page, perPage },
    };
  }

  async getEmailTemplate(id: UUIDType) {
    return this.mapOverrideTemplate(await this.getEmailTemplateRecord(id));
  }

  getDefaultEmailTemplate(event: EmailTemplateEvent) {
    return this.mapDefaultTemplate(this.emailTemplateValidationService.getDefinition(event));
  }

  async copyDefaultEmailTemplate(event: EmailTemplateEvent) {
    const definition = this.emailTemplateValidationService.getDefinition(event);
    this.emailTemplateValidationService.validateDraft(
      event,
      definition.subjects,
      definition.defaultDocuments,
    );

    const template = await this.emailTemplateRepository.createEmailTemplate({
      event,
      name: definition.name,
      subject: definition.subjects,
      content: definition.defaultDocuments,
      status: EMAIL_TEMPLATE_STATUSES.DRAFT,
      baseLanguage: definition.defaultLanguage,
      availableLocales: Object.values(SUPPORTED_LANGUAGES),
    });

    return this.mapCreatedTemplate(template);
  }

  async createEmailTemplate(body: CreateEmailTemplateBody, tenantId: UUIDType) {
    const baseLanguage = body.baseLanguage ?? SUPPORTED_LANGUAGES.EN;
    this.emailTemplateValidationService.validateDraft(body.event, body.subject, body.content);
    await this.emailTemplateAssetService.validateEmailTemplateAssets(body.content, tenantId);

    const template = await this.emailTemplateRepository.createEmailTemplate({
      ...body,
      status: EMAIL_TEMPLATE_STATUSES.DRAFT,
      baseLanguage,
      availableLocales: this.getLocalesWithDraftContent(body.subject, body.content),
    });

    return this.mapCreatedTemplate(template);
  }

  async updateEmailTemplate(id: UUIDType, body: UpdateEmailTemplateBody) {
    return this.emailTemplateRepository.withLockedEmailTemplate(id, async (existing) => {
      const { name, subject, content } = this.getUpdatedEmailTemplateContent(existing, body);
      await this.emailTemplateAssetService.validateEmailTemplateAssets(content, existing.tenantId);

      if (existing.status === EMAIL_TEMPLATE_STATUSES.PUBLISHED) {
        this.emailTemplateValidationService.validatePublished(
          existing.event,
          name,
          subject,
          content,
          existing.baseLanguage,
        );
      } else {
        this.emailTemplateValidationService.validateDraft(existing.event, subject, content);
      }

      const template = await this.emailTemplateRepository.updateEmailTemplateTranslations(id, {
        ...body,
        availableLocales: this.getLocalesWithDraftContent(subject, content),
        updatedAt: new Date().toISOString(),
      });

      return this.mapUpdatedTemplate(template);
    });
  }

  async updateBaseLanguage(id: UUIDType, body: UpdateEmailTemplateBaseLanguageBody) {
    return this.emailTemplateRepository.withLockedEmailTemplate(id, async (existing) => {
      this.emailTemplateValidationService.validatePublished(
        existing.event,
        existing.name,
        existing.subject,
        existing.content,
        body.baseLanguage,
      );

      const template = await this.emailTemplateRepository.updateEmailTemplate(id, {
        baseLanguage: body.baseLanguage,
        updatedAt: new Date().toISOString(),
      });

      return this.mapUpdatedTemplate(template);
    });
  }

  async publishEmailTemplate(id: UUIDType) {
    return this.emailTemplateRepository.withLockedEmailTemplate(id, async (existing) => {
      await this.emailTemplateAssetService.validateEmailTemplateAssets(
        existing.content,
        existing.tenantId,
      );
      this.emailTemplateValidationService.validatePublished(
        existing.event,
        existing.name,
        existing.subject,
        existing.content,
        existing.baseLanguage,
      );

      try {
        const template = await this.emailTemplateRepository.publishEmailTemplate(
          id,
          existing.event,
        );
        return this.mapUpdatedTemplate(template);
      } catch (error) {
        if (this.isUniqueConstraintError(error)) {
          throw new ConflictException("emailTemplates.errors.publicationConflict");
        }
        throw error;
      }
    });
  }

  async archiveEmailTemplate(id: UUIDType) {
    return this.emailTemplateRepository.withLockedEmailTemplate(id, async () => {
      const template = await this.emailTemplateRepository.updateEmailTemplate(id, {
        status: EMAIL_TEMPLATE_STATUSES.ARCHIVED,
        archivedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      return this.mapUpdatedTemplate(template);
    });
  }

  async deleteEmailTemplate(id: UUIDType) {
    return this.emailTemplateRepository.withLockedEmailTemplate(id, async () => {
      await this.emailTemplateRepository.deleteEmailTemplate(id);
    });
  }

  async restoreEmailTemplate(id: UUIDType) {
    return this.emailTemplateRepository.withLockedEmailTemplate(id, async () => {
      const template = await this.emailTemplateRepository.updateEmailTemplate(id, {
        status: EMAIL_TEMPLATE_STATUSES.DRAFT,
        archivedAt: null,
        updatedAt: new Date().toISOString(),
      });
      return this.mapUpdatedTemplate(template);
    });
  }

  async previewEmailTemplate(
    body: PreviewEmailTemplateBody,
    tenantId: UUIDType,
    userId: UUIDType,
  ): Promise<EmailTemplatePreviewResponse> {
    const { attachments: _attachments, ...preview } = await this.renderSampleEmailTemplate(
      body,
      tenantId,
      userId,
      true,
    );
    return preview;
  }

  async renderSampleEmailTemplate(
    body: PreviewEmailTemplateBody,
    tenantId: UUIDType,
    userId: UUIDType,
    preview = false,
  ) {
    this.emailTemplateValidationService.validateDraft(body.event, body.subject, body.content);
    const language = this.emailTemplateValidationService.resolveEmailTemplateLanguage(
      body.subject,
      body.content,
      body.language,
      body.baseLanguage,
    );
    const subject = body.subject[language];
    const document = body.content[language];

    if (!subject || !document)
      throw new BadRequestException("emailTemplates.errors.incompleteBaseLanguage");

    const variables = this.emailTemplateValidationService.getSampleVariables(body.event);

    await this.emailTemplateAssetService.validateEmailTemplateAssets(body.content, tenantId);
    const resolved = await this.emailTemplateAssetService.resolveEmailTemplateAssets(
      document,
      tenantId,
      preview,
    );
    if (!preview) {
      this.emailTemplateValidationService.validateRuntimeVariables(
        body.event,
        document,
        variables,
        subject,
      );
    }

    const branding = await this.getSampleEmailBranding(tenantId, userId, language, preview);
    const rendered = renderEmailTemplate({
      event: body.event,
      language,
      document: resolved.document,
      subject,
      variables,
      branding,
    });

    return {
      event: body.event,
      language,
      ...rendered,
      attachments: resolved.attachments,
      warnings: this.emailTemplateValidationService.getTranslationWarnings(
        body.subject,
        body.content,
        body.baseLanguage,
      ),
    };
  }

  async duplicateEmailTemplate(id: UUIDType) {
    return this.emailTemplateRepository.withLockedEmailTemplate(id, async (existing) => {
      await this.emailTemplateAssetService.validateEmailTemplateAssets(
        existing.content,
        existing.tenantId,
      );
      const template = await this.emailTemplateRepository.createEmailTemplate({
        event: existing.event,
        name: existing.name,
        subject: existing.subject,
        content: existing.content,
        baseLanguage: existing.baseLanguage,
        availableLocales: existing.availableLocales,
        status: EMAIL_TEMPLATE_STATUSES.DRAFT,
      });
      return this.mapCreatedTemplate(template);
    });
  }

  private async getSampleEmailBranding(
    tenantId: UUIDType,
    userId: UUIDType,
    language: SupportedLanguages,
    preview: boolean,
  ) {
    const branding = await this.emailService.getDefaultEmailProperties(tenantId, userId, language);
    const logoUrl = await this.emailService.getEmailPreviewLogo(tenantId);

    if (preview) {
      return {
        ...branding,
        logoUrl,
        borderCircleUrl: await this.emailService.getEmailPreviewBorderCircle(tenantId),
      };
    }

    return {
      ...branding,
      logoUrl: logoUrl ? "cid:logo" : logoUrl,
      borderCircleUrl: "cid:border-circle",
    };
  }

  private getDefaultEmailTemplatesForPage(offset: number, perPage: number, overrideCount: number) {
    const startIndex = Math.max(0, offset - overrideCount);
    const endIndex = Math.max(0, offset + perPage - overrideCount);

    return EMAIL_TEMPLATE_DEFINITIONS.slice(startIndex, endIndex).map((definition) =>
      this.mapDefaultTemplate(definition),
    );
  }

  private async getEmailTemplateRecord(id: UUIDType) {
    const template = await this.emailTemplateRepository.findEmailTemplateById(id);
    if (!template) throw new NotFoundException("emailTemplates.errors.notFound");
    return template;
  }

  private getEmailTemplateVariables(event: EmailTemplateEvent) {
    return [
      ...EMAIL_TEMPLATE_SYSTEM_VARIABLES,
      ...this.emailTemplateValidationService.getDefinition(event).variables,
    ].map((variable) => ({
      ...variable,
      sampleValue:
        typeof variable.sampleValue === "object" ? [...variable.sampleValue] : variable.sampleValue,
    }));
  }

  private mapDefaultTemplate(definition: EmailTemplateDefinition): EmailTemplateResponse {
    return {
      id: null,
      source: "default",
      editable: false,
      variables: this.getEmailTemplateVariables(definition.event),
      event: definition.event,
      name: definition.name,
      subject: definition.subjects,
      content: definition.defaultDocuments,
      status: null,
      baseLanguage: definition.defaultLanguage,
      availableLocales: Object.values(SUPPORTED_LANGUAGES),
      completeLocales: this.emailTemplateValidationService.getCompleteLocales(
        definition.subjects,
        definition.defaultDocuments,
      ),
      createdAt: null,
      updatedAt: null,
      publishedAt: null,
      archivedAt: null,
    };
  }

  private mapOverrideTemplate(template: EmailTemplateRecord): EmailTemplateResponse {
    return {
      id: template.id,
      source: "override",
      editable: true,
      variables: this.getEmailTemplateVariables(template.event),
      event: template.event,
      name: template.name,
      subject: template.subject,
      content: template.content,
      status: template.status,
      baseLanguage: template.baseLanguage,
      availableLocales: template.availableLocales,
      completeLocales: this.emailTemplateValidationService.getCompleteLocales(
        template.subject,
        template.content,
      ),
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      publishedAt: template.publishedAt,
      archivedAt: template.archivedAt,
    };
  }

  private mapCreatedTemplate(template: EmailTemplateRecord | undefined) {
    if (!template) throw new UnprocessableEntityException("emailTemplates.errors.createFailed");
    return this.mapOverrideTemplate(template);
  }

  private mapUpdatedTemplate(template: EmailTemplateRecord | undefined) {
    if (!template) throw new NotFoundException("emailTemplates.errors.notFound");
    return this.mapOverrideTemplate(template);
  }

  private getLocalesWithDraftContent(
    subject: LocalizedText,
    content: LocalizedEmailTemplateContent,
  ): SupportedLanguages[] {
    return Object.values(SUPPORTED_LANGUAGES).filter(
      (language) => subject[language] !== undefined || content[language] !== undefined,
    );
  }

  private getUpdatedEmailTemplateContent(
    existingTemplate: EmailTemplateRecord,
    updates: UpdateEmailTemplateBody,
  ) {
    return {
      name: { ...existingTemplate.name, ...updates.name },
      subject: { ...existingTemplate.subject, ...updates.subject },
      content: { ...existingTemplate.content, ...updates.content },
    };
  }

  private isUniqueConstraintError(error: unknown) {
    return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
  }
}
