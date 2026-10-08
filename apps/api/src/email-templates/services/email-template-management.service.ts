import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";
import {
  VISIBLE_BUILT_IN_EMAIL_TEMPLATE_KEYS,
  getBuiltInTemplateEvent,
} from "@repo/email-templates";
import {
  EMAIL_TEMPLATE_STATUSES,
  renderEmailTemplate,
  getBuiltInTemplatePublication,
  deriveEmailTemplatePlaceholders,
  deriveEmailTemplatePublicationUsage,
  type PublishedEmailTemplate,
  type LocalizedEmailTemplateContent,
} from "@repo/email-templates";
import {
  BUILT_IN_EMAIL_TEMPLATE_KEYS,
  type BuiltInEmailTemplateKey,
  SUPPORTED_LANGUAGES,
  type LocalizedText,
  type SupportedLanguages,
} from "@repo/shared";
import { isEqual } from "lodash";

import { findAutomationEventDefinition } from "src/automations/catalog/automation-event-catalog";
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

import {
  EMAIL_TEMPLATE_DEPENDENCIES,
  type EmailTemplateCatalogEntry,
  type EmailTemplateDependencies,
  type EmailTemplateActivityLogSnapshot,
  type EmailTemplateRecord,
} from "../email-template.types";
import { EmailTemplateRepository } from "../repositories/email-template.repository";

import { EmailTemplateAssetService } from "./email-template-asset.service";
import { addEmailTagLabelsAndSampleValues } from "./email-template-placeholder.utils";
import { EmailTemplateValidationService } from "./email-template-validation.service";

import type {
  PublishEmailTemplateBody,
  CreateEmailTemplateBody,
  EmailTemplatePreviewResponse,
  EmailTemplateResponse,
  PreviewEmailTemplateBody,
  UpdateEmailTemplateBaseLanguageBody,
  UpdateEmailTemplateBody,
} from "../schemas/email-template.schema";
import type { ActorUserType } from "src/common/types/actor-user.type";

@Injectable()
export class EmailTemplateManagementService {
  constructor(
    private readonly emailTemplateRepository: EmailTemplateRepository,
    private readonly emailTemplateValidationService: EmailTemplateValidationService,
    private readonly emailService: EmailService,
    private readonly emailTemplateAssetService: EmailTemplateAssetService,
    private readonly outboxPublisher: OutboxPublisher,
    @Inject(DB) private readonly db: DatabasePg,
    @Inject(EMAIL_TEMPLATE_DEPENDENCIES)
    private readonly emailTemplateDependencies: EmailTemplateDependencies,
  ) {}

  async getPublishedEmailTemplateCatalog(): Promise<EmailTemplateCatalogEntry[]> {
    const catalog: EmailTemplateCatalogEntry[] = [];

    for (const key of Object.values(BUILT_IN_EMAIL_TEMPLATE_KEYS)) {
      catalog.push({
        reference: { type: "builtin", key },
        ...getBuiltInTemplatePublication(key),
      });
    }

    const customTemplates = await this.emailTemplateRepository.findPublishedEmailTemplates();

    for (const template of customTemplates) {
      if (!template.publication) {
        continue;
      }

      catalog.push({
        reference: { type: "custom", id: template.id },
        ...template.publication,
      });
    }

    return catalog.map((entry) => {
      const publication = deriveEmailTemplatePublicationUsage(entry);

      return {
        ...entry,
        ...publication,
        placeholders: publication.placeholders.filter((tag) => tag.required),
      };
    });
  }

  private getEmailTemplatePublication(template: EmailTemplateRecord): PublishedEmailTemplate {
    return {
      name: template.name,
      subject: template.subject,
      content: template.content,
      baseLanguage: template.baseLanguage,
      availableLocales: template.availableLocales,
      placeholders: deriveEmailTemplatePlaceholders(
        template.placeholders,
        template.subject,
        template.content,
      ),
    };
  }

  async listEmailTemplates(
    page = 1,
    perPage = DEFAULT_PAGE_SIZE,
    search = "",
    language: SupportedLanguages = SUPPORTED_LANGUAGES.EN,
  ) {
    const query = search.trim();
    const offset = (page - 1) * perPage;

    const { templates: overrides, totalItems: overrideCount } =
      await this.emailTemplateRepository.findCustomEmailTemplatePageWithCount(
        offset,
        perPage,
        query,
        language,
      );

    const overrideTemplates = overrides.map((template) =>
      this.mapCustomEmailTemplateResponse(template),
    );

    const matchingDefaults = VISIBLE_BUILT_IN_EMAIL_TEMPLATE_KEYS.map((key) =>
      this.mapDefaultEmailTemplateResponse(key),
    ).filter((template) =>
      [template.name, template.subject].some((values) =>
        (values[language] || values[template.baseLanguage] || "")
          .toLocaleLowerCase(language)
          .includes(query.toLocaleLowerCase(language)),
      ),
    );

    const defaultTemplates = matchingDefaults.slice(
      Math.max(0, offset - overrideCount),
      Math.max(0, offset + perPage - overrideCount),
    );

    return {
      data: [...overrideTemplates, ...defaultTemplates],
      pagination: {
        totalItems: overrideCount + matchingDefaults.length,
        page,
        perPage,
      },
    };
  }

  async getEmailTemplate(id: UUIDType) {
    return this.mapCustomEmailTemplateResponse(await this.getEmailTemplateOrThrow(id));
  }

  getBuiltInEmailTemplate(key: BuiltInEmailTemplateKey) {
    return this.mapDefaultEmailTemplateResponse(key);
  }

  async createDraftFromBuiltInEmailTemplate(key: BuiltInEmailTemplateKey, actor?: ActorUserType) {
    const event = getBuiltInTemplateEvent(key);
    const publication = getBuiltInTemplatePublication(key);

    this.emailTemplateValidationService.assertValidEmailTemplateDraft(
      publication.placeholders,
      publication.subject,
      publication.content,
    );

    return this.db.transaction(async () => {
      const template = await this.emailTemplateRepository.insertEmailTemplate({
        event: null,
        triggerEventKind: findAutomationEventDefinition(event)?.kind ?? null,
        name: publication.name,
        subject: publication.subject,
        content: publication.content,
        placeholders: publication.placeholders,
        status: EMAIL_TEMPLATE_STATUSES.DRAFT,
        baseLanguage: publication.baseLanguage,
        availableLocales: Object.values(SUPPORTED_LANGUAGES),
      });

      await this.recordEmailTemplateCreation(actor, template, {
        source: "default",
        sourceEvent: event,
      });

      return this.mapCreatedEmailTemplateResponse(template);
    });
  }

  async createEmailTemplate(
    body: CreateEmailTemplateBody,
    tenantId: UUIDType,
    actor?: ActorUserType,
  ) {
    const baseLanguage = body.baseLanguage ?? SUPPORTED_LANGUAGES.EN;
    const { populateEventTags, ...metadata } = body;
    const event = findAutomationEventDefinition(body.triggerEventKind);

    if (populateEventTags && !event) {
      throw new BadRequestException("emailTemplates.errors.unsupportedEvent");
    }

    const eventPlaceholders =
      populateEventTags && event
        ? event.providedVariables.map((field) => ({
            name: field.key,
            label: field.label,
            type: field.dataType,
            required: false,
            sampleValue: field.sampleValue,
          }))
        : [];

    const authoredPlaceholders = body.placeholders ?? [];

    const placeholders = deriveEmailTemplatePlaceholders(
      addEmailTagLabelsAndSampleValues([
        ...eventPlaceholders.filter(
          (field) => !authoredPlaceholders.some((item) => item.name === field.name),
        ),
        ...authoredPlaceholders,
      ]),
      body.subject,
      body.content,
    );

    this.emailTemplateValidationService.assertValidEmailTemplateDraft(
      placeholders,
      body.subject,
      body.content,
    );
    await this.emailTemplateAssetService.assertEmailTemplateAssetsAccessible(
      body.content,
      tenantId,
    );

    return this.db.transaction(async () => {
      const template = await this.emailTemplateRepository.insertEmailTemplate({
        ...metadata,
        event: null,
        placeholders,
        status: EMAIL_TEMPLATE_STATUSES.DRAFT,
        baseLanguage,
        availableLocales: this.getEmailTemplateDraftLocales(body.subject, body.content),
      });

      await this.recordEmailTemplateCreation(actor, template, { source: "new" });

      return this.mapCreatedEmailTemplateResponse(template);
    });
  }

  async updateEmailTemplate(id: UUIDType, body: UpdateEmailTemplateBody, actor?: ActorUserType) {
    if (body.placeholders) {
      body = { ...body, placeholders: addEmailTagLabelsAndSampleValues(body.placeholders) };
    }

    return this.emailTemplateRepository.withLockedEmailTemplate(
      id,
      async (existing, transaction) => {
        const { subject, content } = this.getUpdatedEmailTemplateContent(existing, body);

        const placeholders = deriveEmailTemplatePlaceholders(
          addEmailTagLabelsAndSampleValues(body.placeholders ?? existing.placeholders),
          subject,
          content,
        );

        await this.emailTemplateAssetService.assertEmailTemplateAssetsAccessible(
          content,
          existing.tenantId,
        );

        if (existing.status === EMAIL_TEMPLATE_STATUSES.ARCHIVED) {
          throw new BadRequestException("emailTemplates.errors.archivedReadOnly");
        }

        this.emailTemplateValidationService.assertValidEmailTemplateDraft(
          placeholders,
          subject,
          content,
        );

        const template = await this.emailTemplateRepository.updateEmailTemplateTranslations(id, {
          ...body,
          placeholders,
          availableLocales: this.getEmailTemplateDraftLocales(subject, content),
          updatedAt: new Date().toISOString(),
        });

        if (template) {
          await this.emailTemplateDependencies.removeUnusedEmailTagMappingsFromAutomations(
            id,
            this.getEmailTemplatePublication(template),
            false,
            transaction,
          );
        }

        if (actor && template) {
          await this.recordEmailTemplateUpdate(actor, existing, template, body);
        }

        return this.mapUpdatedEmailTemplateResponse(template);
      },
    );
  }

  async updateEmailTemplateBaseLanguage(
    id: UUIDType,
    body: UpdateEmailTemplateBaseLanguageBody,
    actor?: ActorUserType,
  ) {
    return this.emailTemplateRepository.withLockedEmailTemplate(id, async (existing) => {
      if (existing.status === EMAIL_TEMPLATE_STATUSES.ARCHIVED) {
        throw new BadRequestException("emailTemplates.errors.archivedReadOnly");
      }

      this.emailTemplateValidationService.assertEmailTemplatePublishable(
        existing.placeholders,
        existing.name,
        existing.subject,
        existing.content,
        body.baseLanguage,
      );

      const template = await this.emailTemplateRepository.updateEmailTemplate(id, {
        baseLanguage: body.baseLanguage,
        updatedAt: new Date().toISOString(),
      });

      if (actor && template) {
        await this.outboxPublisher.publish(
          new UpdateEmailTemplateEvent({
            actor,
            resource: this.mapEmailTemplateActivitySnapshot(template),
            previous: this.mapEmailTemplateActivitySnapshot(existing),
            changedFields: ["baseLanguage"],
          }),
        );
      }

      return this.mapUpdatedEmailTemplateResponse(template);
    });
  }

  async publishEmailTemplate(
    id: UUIDType,
    actor?: ActorUserType,
    options: PublishEmailTemplateBody = {},
  ) {
    return this.emailTemplateRepository.withLockedEmailTemplate(
      id,
      async (existing, transaction) => {
        if (existing.status === EMAIL_TEMPLATE_STATUSES.ARCHIVED) {
          throw new BadRequestException("emailTemplates.errors.archivedReadOnly");
        }

        await this.emailTemplateAssetService.assertEmailTemplateAssetsAccessible(
          existing.content,
          existing.tenantId,
        );
        this.emailTemplateValidationService.assertEmailTemplatePublishable(
          existing.placeholders,
          existing.name,
          existing.subject,
          existing.content,
          existing.baseLanguage,
        );

        const publication = this.getEmailTemplatePublication(existing);

        await this.emailTemplateDependencies.removeUnusedEmailTagMappingsFromAutomations(
          id,
          publication,
          true,
          transaction,
        );

        await this.emailTemplateDependencies.prepareAutomationsForEmailTemplatePublication(
          id,
          publication,
          transaction,
          options,
          actor,
        );

        const { template } = await this.emailTemplateRepository.publishEmailTemplate(
          id,
          publication,
          transaction,
        );

        await this.emailTemplateDependencies.cancelPendingEmailTemplateDeliveries(id, transaction);

        if (actor && template) {
          await this.outboxPublisher.publish(
            new PublishEmailTemplateEvent({
              actor,
              resource: this.mapEmailTemplateActivitySnapshot(template),
              previous: this.mapEmailTemplateActivitySnapshot(existing),
              changedFields: ["publication"],
            }),
            transaction,
          );
        }

        return this.mapUpdatedEmailTemplateResponse(template);
      },
    );
  }

  async archiveEmailTemplate(id: UUIDType, actor?: ActorUserType) {
    return this.emailTemplateRepository.withLockedEmailTemplate(
      id,
      async (existing, transaction) => {
        await this.emailTemplateDependencies.assertEmailTemplateCanBeArchived(id, transaction);
        await this.emailTemplateDependencies.cancelPendingEmailTemplateDeliveries(id, transaction);

        const template = await this.emailTemplateRepository.updateEmailTemplate(id, {
          status: EMAIL_TEMPLATE_STATUSES.ARCHIVED,
          archivedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

        if (actor && template) {
          await this.outboxPublisher.publish(
            new ArchiveEmailTemplateEvent({
              actor,
              resource: this.mapEmailTemplateActivitySnapshot(template),
              previous: this.mapEmailTemplateActivitySnapshot(existing),
              changedFields: ["status"],
              context: { reason: "manual" },
            }),
          );
        }

        return this.mapUpdatedEmailTemplateResponse(template);
      },
    );
  }

  async deleteEmailTemplate(id: UUIDType, actor?: ActorUserType) {
    await this.emailTemplateRepository.withLockedEmailTemplate(
      id,
      async (existing, transaction) => {
        await this.emailTemplateDependencies.assertEmailTemplateCanBeArchived(id, transaction);
        await this.emailTemplateDependencies.cancelPendingEmailTemplateDeliveries(id, transaction);
        await this.emailTemplateRepository.softDeleteEmailTemplate(id);

        if (actor) {
          await this.outboxPublisher.publish(
            new DeleteEmailTemplateEvent({
              actor,
              resource: this.mapEmailTemplateActivitySnapshot(existing),
            }),
          );
        }
      },
    );
  }

  async restoreEmailTemplate(id: UUIDType, actor?: ActorUserType) {
    return this.emailTemplateRepository.withLockedEmailTemplate(id, async (existing) => {
      const template = await this.emailTemplateRepository.updateEmailTemplate(id, {
        status: EMAIL_TEMPLATE_STATUSES.DRAFT,
        archivedAt: null,
        updatedAt: new Date().toISOString(),
      });

      if (actor && template) {
        await this.outboxPublisher.publish(
          new RestoreEmailTemplateEvent({
            actor,
            resource: this.mapEmailTemplateActivitySnapshot(template),
            previous: this.mapEmailTemplateActivitySnapshot(existing),
            changedFields: ["status"],
          }),
        );
      }

      return this.mapUpdatedEmailTemplateResponse(template);
    });
  }

  async removeEmailTemplateLanguage(
    id: UUIDType,
    language: SupportedLanguages,
    actor: ActorUserType,
  ) {
    return this.emailTemplateRepository.withLockedEmailTemplate(
      id,
      async (existing, transaction) => {
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
          return this.mapCustomEmailTemplateResponse(existing);
        }

        const template = await this.emailTemplateRepository.removeEmailTemplateLanguage(
          id,
          language,
          existing.availableLocales.filter((locale) => locale !== language) as SupportedLanguages[],
        );

        if (template) {
          await this.emailTemplateDependencies.removeUnusedEmailTagMappingsFromAutomations(
            id,
            this.getEmailTemplatePublication(template),
            false,
            transaction,
          );
          await this.outboxPublisher.publish(
            new RemoveEmailTemplateLanguageEvent({
              actor,
              resource: this.mapEmailTemplateActivitySnapshot(template),
              previous: this.mapEmailTemplateActivitySnapshot(existing),
              changedFields: ["language"],
              context: { language },
            }),
          );
        }

        return this.mapUpdatedEmailTemplateResponse(template);
      },
    );
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
    const { language, subject, document, variables } = this.prepareEmailTemplateSample(body);

    await this.emailTemplateAssetService.assertEmailTemplateAssetsAccessible(
      body.content,
      tenantId,
    );

    const resolved = await this.emailTemplateAssetService.resolveEmailTemplateAssets(
      document,
      tenantId,
      preview,
    );

    if (!preview) {
      this.emailTemplateValidationService.assertEmailTemplateVariableValues(
        body.placeholders ?? [],
        document,
        variables,
        subject,
      );
    }

    const branding = await this.getSampleEmailBranding(tenantId, userId, language, preview);

    const rendered = renderEmailTemplate({
      language,
      document: resolved.document,
      subject,
      variables,
      branding,
    });

    return {
      language,
      ...rendered,
      attachments: resolved.attachments,
      warnings: this.emailTemplateValidationService.collectEmailTemplateTranslationWarnings(
        body.subject,
        body.content,
        body.baseLanguage,
      ),
    };
  }

  async duplicateEmailTemplate(id: UUIDType, actor?: ActorUserType) {
    return this.emailTemplateRepository.withLockedEmailTemplate(id, async (existing) => {
      await this.emailTemplateAssetService.assertEmailTemplateAssetsAccessible(
        existing.content,
        existing.tenantId,
      );

      const template = await this.emailTemplateRepository.insertEmailTemplate({
        event: null,
        triggerEventKind: existing.triggerEventKind,
        placeholders: existing.placeholders,
        name: existing.name,
        subject: existing.subject,
        content: existing.content,
        baseLanguage: existing.baseLanguage,
        availableLocales: existing.availableLocales,
        status: EMAIL_TEMPLATE_STATUSES.DRAFT,
      });

      await this.recordEmailTemplateCreation(actor, template, {
        source: "duplicate",
        sourceTemplateId: id,
      });

      return this.mapCreatedEmailTemplateResponse(template);
    });
  }

  private mapEmailTemplateActivitySnapshot(
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

  private async recordEmailTemplateCreation(
    actor: ActorUserType | undefined,
    template: EmailTemplateRecord | undefined,
    context: Record<string, string>,
  ) {
    if (!actor || !template) {
      return;
    }

    await this.outboxPublisher.publish(
      new CreateEmailTemplateEvent({
        actor,
        resource: this.mapEmailTemplateActivitySnapshot(template),
        context,
      }),
    );
  }

  private prepareEmailTemplateSample(body: PreviewEmailTemplateBody) {
    this.emailTemplateValidationService.assertValidEmailTemplateDraft(
      body.placeholders ?? [],
      body.subject,
      body.content,
    );

    const language = this.emailTemplateValidationService.resolveEmailTemplateLanguage(
      body.subject,
      body.content,
      body.language,
      body.baseLanguage,
    );

    const subject = body.subject[language];
    const document = body.content[language];

    if (!subject || !document) {
      throw new BadRequestException("emailTemplates.errors.incompleteBaseLanguage");
    }

    const variables = this.emailTemplateValidationService.buildSafeEmailPreviewVariables(
      body.placeholders ?? [],
      language,
    );

    return { language, subject, document, variables };
  }

  private async recordEmailTemplateUpdate(
    actor: ActorUserType,
    existing: EmailTemplateRecord,
    template: EmailTemplateRecord,
    body: UpdateEmailTemplateBody,
  ): Promise<void> {
    const languages = this.getChangedEmailTemplateLanguages(body);
    const changedFields = Object.keys(body);
    const previous = this.mapEmailTemplateActivitySnapshot(existing, body);
    const resource = this.mapEmailTemplateActivitySnapshot(template, body);

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

    for (const language of this.getAddedEmailTemplateLanguages(existing, template)) {
      await this.outboxPublisher.publish(
        new AddEmailTemplateLanguageEvent({
          actor,
          resource: this.mapEmailTemplateActivitySnapshot(template),
          previous: this.mapEmailTemplateActivitySnapshot(existing),
          changedFields: ["language"],
          context: { language },
        }),
      );
    }
  }

  private getChangedEmailTemplateLanguages(body: UpdateEmailTemplateBody): string[] {
    return [
      ...new Set([
        ...Object.keys(body.name ?? {}),
        ...Object.keys(body.subject ?? {}),
        ...Object.keys(body.content ?? {}),
      ]),
    ];
  }

  private getAddedEmailTemplateLanguages(
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

  private async getEmailTemplateOrThrow(id: UUIDType) {
    const template = await this.emailTemplateRepository.findEmailTemplateById(id);

    if (!template) {
      throw new NotFoundException("emailTemplates.errors.notFound");
    }

    return template;
  }

  private mapDefaultEmailTemplateResponse(key: BuiltInEmailTemplateKey): EmailTemplateResponse {
    const publication = getBuiltInTemplatePublication(key);

    return {
      id: null,
      source: "default",
      editable: false,
      publicationVersion: 0,
      hasUnpublishedChanges: false,
      variables: publication.placeholders.map((placeholder) => ({
        key: placeholder.name,
        label: placeholder.label,
        type:
          placeholder.type === "string" || placeholder.type === "localized_string"
            ? ("text" as const)
            : placeholder.type,
        required: placeholder.required,
        sampleValue:
          placeholder.sampleValue as EmailTemplateResponse["variables"][number]["sampleValue"],
      })),
      ...publication,
      event: key,
      triggerEventKind: getBuiltInTemplateEvent(key),
      status: null,
      completeLocales: this.emailTemplateValidationService.getCompleteEmailTemplateLocales(
        publication.subject,
        publication.content,
      ),
      createdAt: null,
      updatedAt: null,
      publishedAt: null,
      archivedAt: null,
    };
  }

  private mapCustomEmailTemplateResponse(template: EmailTemplateRecord): EmailTemplateResponse {
    const placeholders = deriveEmailTemplatePlaceholders(
      template.placeholders,
      template.subject,
      template.content,
    );

    return {
      id: template.id,
      source: "override",
      editable: true,
      publicationVersion: template.publicationVersion,
      hasUnpublishedChanges: !isEqual(
        template.publication && deriveEmailTemplatePublicationUsage(template.publication),
        this.getEmailTemplatePublication(template),
      ),
      variables: placeholders.map((placeholder) => ({
        key: placeholder.name,
        label: placeholder.label,
        type:
          placeholder.type === "string" || placeholder.type === "localized_string"
            ? ("text" as const)
            : placeholder.type,
        required: placeholder.required,
        sampleValue:
          placeholder.sampleValue as EmailTemplateResponse["variables"][number]["sampleValue"],
      })),
      placeholders,
      triggerEventKind: template.triggerEventKind,
      event: null,
      name: template.name,
      subject: template.subject,
      content: template.content,
      status: template.status,
      baseLanguage: template.baseLanguage,
      availableLocales: template.availableLocales,
      completeLocales: this.emailTemplateValidationService.getCompleteEmailTemplateLocales(
        template.subject,
        template.content,
      ),
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
      publishedAt: template.publishedAt,
      archivedAt: template.archivedAt,
    };
  }

  private mapCreatedEmailTemplateResponse(template: EmailTemplateRecord | undefined) {
    if (!template) {
      throw new UnprocessableEntityException("emailTemplates.errors.createFailed");
    }

    return this.mapCustomEmailTemplateResponse(template);
  }

  private mapUpdatedEmailTemplateResponse(template: EmailTemplateRecord | undefined) {
    if (!template) {
      throw new NotFoundException("emailTemplates.errors.notFound");
    }

    return this.mapCustomEmailTemplateResponse(template);
  }

  private getEmailTemplateDraftLocales(
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
}
