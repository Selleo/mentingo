import {
  BadRequestException,
  ConflictException,
  Inject,
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

import { DatabasePg, type UUIDType } from "src/common";
import { EmailService } from "src/common/emails/emails.service";
import { DEFAULT_PAGE_SIZE } from "src/common/pagination";
import {
  AddEmailTemplateLanguageEvent,
  ArchiveEmailTemplateEvent,
  CreateEmailTemplateEvent,
  DeleteEmailTemplateEvent,
  PublishEmailTemplateEvent,
  RemoveEmailTemplateLanguageEvent,
  RestoreEmailTemplateEvent,
  UpdateEmailTemplateEvent,
} from "src/events";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { DB } from "src/storage/db/db.providers";

import { EmailTemplateRepository } from "../repositories/email-template.repository";

import { EmailTemplateAssetService } from "./email-template-asset.service";
import { EmailTemplateValidationService } from "./email-template-validation.service";

import type {
  EmailTemplateActivityLogSnapshot,
  EmailTemplateRecord,
} from "../email-template.types";
import type {
  CreateEmailTemplateBody,
  EmailTemplatePreviewResponse,
  EmailTemplateResponse,
  PreviewEmailTemplateBody,
  UpdateEmailTemplateBaseLanguageBody,
  UpdateEmailTemplateBody,
} from "../schemas/email-template.schema";
import type { ActorUserType } from "src/common/types/actor-user.type";

@Injectable()
export class EmailTemplateService {
  constructor(
    private readonly emailTemplateRepository: EmailTemplateRepository,
    private readonly emailTemplateValidationService: EmailTemplateValidationService,
    private readonly emailService: EmailService,
    private readonly emailTemplateAssetService: EmailTemplateAssetService,
    private readonly outboxPublisher: OutboxPublisher,
    @Inject(DB) private readonly db: DatabasePg,
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

  async copyDefaultEmailTemplate(event: EmailTemplateEvent, actor?: ActorUserType) {
    const definition = this.emailTemplateValidationService.getDefinition(event);
    this.emailTemplateValidationService.validateDraft(
      event,
      definition.subjects,
      definition.defaultDocuments,
    );

    return this.db.transaction(async () => {
      const template = await this.emailTemplateRepository.createEmailTemplate({
        event,
        name: definition.name,
        subject: definition.subjects,
        content: definition.defaultDocuments,
        status: EMAIL_TEMPLATE_STATUSES.DRAFT,
        baseLanguage: definition.defaultLanguage,
        availableLocales: Object.values(SUPPORTED_LANGUAGES),
      });

      await this.publishCreateActivity(actor, template, { source: "default", sourceEvent: event });
      return this.mapCreatedTemplate(template);
    });
  }

  async createEmailTemplate(
    body: CreateEmailTemplateBody,
    tenantId: UUIDType,
    actor?: ActorUserType,
  ) {
    const baseLanguage = body.baseLanguage ?? SUPPORTED_LANGUAGES.EN;
    this.emailTemplateValidationService.validateDraft(body.event, body.subject, body.content);
    await this.emailTemplateAssetService.validateEmailTemplateAssets(body.content, tenantId);

    return this.db.transaction(async () => {
      const template = await this.emailTemplateRepository.createEmailTemplate({
        ...body,
        status: EMAIL_TEMPLATE_STATUSES.DRAFT,
        baseLanguage,
        availableLocales: this.getLocalesWithDraftContent(body.subject, body.content),
      });

      await this.publishCreateActivity(actor, template, { source: "new" });
      return this.mapCreatedTemplate(template);
    });
  }

  async updateEmailTemplate(id: UUIDType, body: UpdateEmailTemplateBody, actor?: ActorUserType) {
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

      if (actor && template) {
        const languages = this.getChangedTranslationLanguages(body);
        const changedFields = Object.keys(body);
        const previous = this.toActivitySnapshot(existing, body);
        const resource = this.toActivitySnapshot(template, body);
        await this.outboxPublisher.publish(
          new UpdateEmailTemplateEvent({
            actor,
            resource,
            previous,
            changedFields,
            context: {
              name: template.name?.[template.baseLanguage as SupportedLanguages] ?? "",
              languages: languages.join(", "),
              changedFields: changedFields.join(", "),
            },
          }),
        );
        for (const language of this.getAddedTemplateLanguages(existing, template)) {
          await this.outboxPublisher.publish(
            new AddEmailTemplateLanguageEvent({
              actor,
              resource: this.toActivitySnapshot(template),
              previous: this.toActivitySnapshot(existing),
              changedFields: ["language"],
              context: { language },
            }),
          );
        }
      }
      return this.mapUpdatedTemplate(template);
    });
  }

  async updateBaseLanguage(
    id: UUIDType,
    body: UpdateEmailTemplateBaseLanguageBody,
    actor?: ActorUserType,
  ) {
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

      if (actor && template)
        await this.outboxPublisher.publish(
          new UpdateEmailTemplateEvent({
            actor,
            resource: this.toActivitySnapshot(template),
            previous: this.toActivitySnapshot(existing),
            changedFields: ["baseLanguage"],
          }),
        );
      return this.mapUpdatedTemplate(template);
    });
  }

  async publishEmailTemplate(id: UUIDType, actor?: ActorUserType) {
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

      let publication;
      try {
        publication = await this.emailTemplateRepository.publishEmailTemplate(id, existing.event);
      } catch (error) {
        if (this.isUniqueConstraintError(error)) {
          throw new ConflictException("emailTemplates.errors.publicationConflict");
        }
        throw error;
      }

      const { template, archivedTemplates } = publication;
      if (actor && template) {
        for (const archivedTemplate of archivedTemplates) {
          const archived = this.toActivitySnapshot(archivedTemplate);
          await this.outboxPublisher.publish(
            new ArchiveEmailTemplateEvent({
              actor,
              resource: archived,
              previous: { ...archived, status: EMAIL_TEMPLATE_STATUSES.PUBLISHED },
              changedFields: ["status"],
              context: { reason: "replaced_by_publish", replacementTemplateId: id },
            }),
          );
        }
        await this.outboxPublisher.publish(
          new PublishEmailTemplateEvent({
            actor,
            resource: this.toActivitySnapshot(template),
            previous: this.toActivitySnapshot(existing),
            changedFields: ["status"],
          }),
        );
      }
      return this.mapUpdatedTemplate(template);
    });
  }

  async archiveEmailTemplate(id: UUIDType, actor?: ActorUserType) {
    return this.emailTemplateRepository.withLockedEmailTemplate(id, async (existing) => {
      const template = await this.emailTemplateRepository.updateEmailTemplate(id, {
        status: EMAIL_TEMPLATE_STATUSES.ARCHIVED,
        archivedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      if (actor && template)
        await this.outboxPublisher.publish(
          new ArchiveEmailTemplateEvent({
            actor,
            resource: this.toActivitySnapshot(template),
            previous: this.toActivitySnapshot(existing),
            changedFields: ["status"],
            context: { reason: "manual" },
          }),
        );
      return this.mapUpdatedTemplate(template);
    });
  }

  async deleteEmailTemplate(id: UUIDType, actor?: ActorUserType) {
    await this.emailTemplateRepository.withLockedEmailTemplate(id, async (existing) => {
      await this.emailTemplateRepository.deleteEmailTemplate(id);
      if (actor)
        await this.outboxPublisher.publish(
          new DeleteEmailTemplateEvent({ actor, resource: this.toActivitySnapshot(existing) }),
        );
    });
  }

  async restoreEmailTemplate(id: UUIDType, actor?: ActorUserType) {
    return this.emailTemplateRepository.withLockedEmailTemplate(id, async (existing) => {
      const template = await this.emailTemplateRepository.updateEmailTemplate(id, {
        status: EMAIL_TEMPLATE_STATUSES.DRAFT,
        archivedAt: null,
        updatedAt: new Date().toISOString(),
      });
      if (actor && template)
        await this.outboxPublisher.publish(
          new RestoreEmailTemplateEvent({
            actor,
            resource: this.toActivitySnapshot(template),
            previous: this.toActivitySnapshot(existing),
            changedFields: ["status"],
          }),
        );
      return this.mapUpdatedTemplate(template);
    });
  }

  async removeEmailTemplateLanguage(
    id: UUIDType,
    language: SupportedLanguages,
    actor: ActorUserType,
  ) {
    return this.emailTemplateRepository.withLockedEmailTemplate(id, async (existing) => {
      if (existing.baseLanguage === language) {
        throw new BadRequestException("emailTemplates.errors.cannotRemoveBaseLanguage");
      }
      if (existing.status === EMAIL_TEMPLATE_STATUSES.ARCHIVED) {
        throw new BadRequestException("emailTemplates.errors.archivedReadOnly");
      }

      const languageExists =
        language in existing.name ||
        language in existing.subject ||
        language in existing.content ||
        existing.availableLocales.includes(language);

      if (!languageExists) {
        return this.mapOverrideTemplate(existing);
      }

      const template = await this.emailTemplateRepository.removeEmailTemplateLanguage(
        id,
        language,
        existing.availableLocales.filter((locale) => locale !== language) as SupportedLanguages[],
      );
      if (template)
        await this.outboxPublisher.publish(
          new RemoveEmailTemplateLanguageEvent({
            actor,
            resource: this.toActivitySnapshot(template),
            previous: this.toActivitySnapshot(existing),
            changedFields: ["language"],
            context: { language },
          }),
        );
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

  async duplicateEmailTemplate(id: UUIDType, actor?: ActorUserType) {
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
      await this.publishCreateActivity(actor, template, {
        source: "duplicate",
        sourceTemplateId: id,
      });
      return this.mapCreatedTemplate(template);
    });
  }

  private toActivitySnapshot(
    template: EmailTemplateRecord,
    update?: UpdateEmailTemplateBody,
  ): EmailTemplateActivityLogSnapshot {
    const localizedValues: Record<string, Record<string, unknown>> = {};
    if (update) {
      for (const field of ["name", "subject", "content"] as const) {
        for (const language of Object.keys(update[field] ?? {})) {
          localizedValues[language] ??= {};
          localizedValues[language][field] =
            template[field]?.[language as SupportedLanguages] ?? null;
        }
      }
    }

    return {
      id: template.id,
      event: template.event,
      ...(!update && {
        name: template.name?.[template.baseLanguage as SupportedLanguages] ?? undefined,
      }),
      status: template.status,
      baseLanguage: template.baseLanguage,
      availableLocales: template.availableLocales,
      ...localizedValues,
    };
  }

  private async publishCreateActivity(
    actor: ActorUserType | undefined,
    template: EmailTemplateRecord | undefined,
    context: Record<string, string>,
  ) {
    if (!actor || !template) return;

    await this.outboxPublisher.publish(
      new CreateEmailTemplateEvent({
        actor,
        resource: this.toActivitySnapshot(template),
        context,
      }),
    );
  }

  private getChangedTranslationLanguages(body: UpdateEmailTemplateBody): string[] {
    return [
      ...new Set([
        ...Object.keys(body.name ?? {}),
        ...Object.keys(body.subject ?? {}),
        ...Object.keys(body.content ?? {}),
      ]),
    ];
  }

  private getAddedTemplateLanguages(
    before: EmailTemplateRecord,
    after: EmailTemplateRecord,
  ): string[] {
    const existingLanguages = new Set(before.availableLocales);
    return after.availableLocales.filter((language) => !existingLanguages.has(language));
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
