import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  computeEmailTemplateDiagnostics,
  DEFAULT_PLATFORM_LOGO_PATH,
  DEFAULT_TENANT_PRIMARY_COLOR,
  EMAIL_TEMPLATE_STATUSES,
  SUPPORTED_LANGUAGES,
  TENANT_LOGO_CID_SRC,
} from "@repo/shared";
import { eq, ilike, ne, type SQL } from "drizzle-orm";

import { EmailService } from "src/common/emails/emails.service";
import { DEFAULT_PAGE_SIZE, parsePagination } from "src/common/pagination";
import { isPostgresUniqueViolation } from "src/common/utils/postgresErrors";
import { FileService } from "src/file/file.service";
import { SettingsService } from "src/settings/settings.service";
import { emailNotificationTemplates } from "src/storage/schema";

import { EmailTemplateCleanupQueueService } from "./email-template-cleanup.queue.service";
import { EmailNotificationTemplatesRepository } from "./email-templates.repository";
import { assertSafeBlockUrls } from "./utils/assertSafeBlockUrls";
import { buildDefaultEmailTemplateBlocks } from "./utils/buildDefaultEmailTemplateBlocks";
import {
  collectImageSrcs,
  extractTenantEmailTemplateImageFileKeyFromUrl,
} from "./utils/emailTemplateImageUrl";
import { flattenTranslationsForRender } from "./utils/flattenTranslationsForRender";
import { pruneOrphanStrings } from "./utils/pruneOrphanStrings";
import { renderTemplateContent } from "./utils/renderTemplateContent";

import type { CreateEmailNotificationTemplate } from "./schemas/createEmailNotificationTemplate.schema";
import type { UpdateEmailNotificationTemplate } from "./schemas/updateEmailNotificationTemplate.schema";
import type {
  EmailTemplateBlocks,
  EmailTemplateStatus,
  EmailTemplateStrings,
  LocalizedText,
  SupportedLanguages,
} from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { EmailTemplateImageCleanupJobData } from "src/queue";

const EMAIL_TEMPLATE_NAME_UNIQUE_INDEX = "email_notification_templates_tenant_id_name_unique_idx";
const EMAIL_TEMPLATE_AUTO_NAME_REGEX = /^Email template #([0-9]+)$/;

@Injectable()
export class EmailNotificationTemplatesService {
  private readonly logger = new Logger(EmailNotificationTemplatesService.name);

  constructor(
    private readonly repository: EmailNotificationTemplatesRepository,
    private readonly fileService: FileService,
    private readonly emailService: EmailService,
    private readonly settingsService: SettingsService,
    private readonly cleanupQueue: EmailTemplateCleanupQueueService,
  ) {}

  async listTemplates(
    paginationQuery: { page?: number; perPage?: number },
    filters: { status?: EmailTemplateStatus; name?: string },
  ) {
    const { page, perPage } = parsePagination(paginationQuery.page, paginationQuery.perPage, {
      perPage: DEFAULT_PAGE_SIZE,
    });
    const conditions = this.buildListConditions(filters);

    return this.repository.listTemplates({ page, perPage }, conditions);
  }

  async createTemplate(input: CreateEmailNotificationTemplate) {
    this.validateLocales(input.baseLanguage, input.availableLocales);
    const blocks = input.blocks ?? buildDefaultEmailTemplateBlocks(input.baseLanguage);
    const strings = input.strings ?? {};
    const subject = input.subject ?? {};

    this.assertSafeRenderedBlockUrls({
      blocks,
      strings,
      availableLocales: input.availableLocales,
      baseLanguage: input.baseLanguage,
    });

    if (input.name) {
      await this.ensureNameAvailable(input.name);
      const template = await this.createTemplateOrThrowNameConflict({
        ...input,
        name: input.name,
        subject,
        blocks,
        strings,
      });
      if (!template) throw new BadRequestException("emailTemplates.toast.createFailed");
      return template;
    }

    return this.createWithAutoName({ ...input, subject, blocks, strings });
  }

  private async createWithAutoName(
    input: CreateEmailNotificationTemplate & {
      subject: LocalizedText;
      blocks: EmailTemplateBlocks;
      strings: EmailTemplateStrings;
    },
  ) {
    const name = await this.buildNextAutoTemplateName();

    return this.createTemplateOrThrowNameConflict({ ...input, name });
  }

  async getTemplateById(id: UUIDType) {
    const template = await this.repository.findById(id);
    if (!template) throw new NotFoundException("emailTemplates.toast.notFound");

    return template;
  }

  async updateTemplate(id: UUIDType, input: UpdateEmailNotificationTemplate, tenantId: UUIDType) {
    const existing = await this.getTemplateById(id);
    const nextBaseLanguage = input.baseLanguage ?? existing.baseLanguage;
    const nextAvailableLocales = input.availableLocales ?? existing.availableLocales;

    if (input.baseLanguage !== undefined || input.availableLocales !== undefined) {
      this.validateLocales(nextBaseLanguage, nextAvailableLocales);
    }

    if (input.name !== undefined && input.name !== existing.name) {
      await this.ensureNameAvailable(input.name, id);
    }

    const nextBlocks = input.blocks ?? existing.blocks;
    const nextStrings = input.strings ?? existing.strings;
    const pruned = pruneOrphanStrings(nextBlocks, nextStrings);
    if (
      input.blocks !== undefined ||
      input.strings !== undefined ||
      input.baseLanguage !== undefined ||
      input.availableLocales !== undefined
    ) {
      this.assertSafeRenderedBlockUrls({
        blocks: nextBlocks,
        strings: pruned,
        availableLocales: nextAvailableLocales,
        baseLanguage: nextBaseLanguage,
      });
    }

    const prevSrcs = new Set(collectImageSrcs(existing.blocks));
    const nextSrcs = new Set(collectImageSrcs(nextBlocks));
    const removedSrcs = new Set([...prevSrcs].filter((s) => !nextSrcs.has(s)));

    let template;
    try {
      template = await this.repository.updateTemplate(
        id,
        this.buildTemplateUpdates(input, nextBlocks, pruned),
      );
    } catch (err) {
      if (isPostgresUniqueViolation(err, EMAIL_TEMPLATE_NAME_UNIQUE_INDEX)) {
        throw new ConflictException("emailTemplates.toast.nameAlreadyExists");
      }
      throw err;
    }
    if (!template) throw new BadRequestException("emailTemplates.toast.updateFailed");

    await this.cleanupOrphanedImages(removedSrcs, tenantId, id);

    return template;
  }

  async publishTemplate(id: UUIDType) {
    const existing = await this.getTemplateById(id);
    this.assertSafeRenderedBlockUrls({
      blocks: existing.blocks,
      strings: existing.strings,
      availableLocales: existing.availableLocales,
      baseLanguage: existing.baseLanguage,
    });
    this.assertPublishable(existing);

    const template = await this.repository.setStatus(id, EMAIL_TEMPLATE_STATUSES.PUBLISHED, null);
    if (!template) throw new BadRequestException("emailTemplates.toast.publishFailed");

    return template;
  }

  async makeDraftTemplate(id: UUIDType) {
    await this.getTemplateById(id);

    const template = await this.repository.setStatus(id, EMAIL_TEMPLATE_STATUSES.DRAFT, null);
    if (!template) throw new BadRequestException("emailTemplates.toast.makeDraftFailed");

    return template;
  }

  async duplicateTemplate(id: UUIDType) {
    const source = await this.getTemplateById(id);

    const rekeyed = this.rekeyBlockUuids(source.blocks, source.strings);
    const name = await this.buildDuplicateName(source.name);

    const duplicate = await this.repository.duplicateFrom({
      name,
      baseLanguage: source.baseLanguage,
      availableLocales: source.availableLocales,
      subject: source.subject,
      blocks: rekeyed.blocks,
      strings: rekeyed.strings,
    });

    if (!duplicate) throw new BadRequestException("emailTemplates.toast.duplicateFailed");

    return duplicate;
  }

  async previewTemplate(id: UUIDType, tenantId: UUIDType, language?: SupportedLanguages) {
    const template = await this.getTemplateById(id);

    const resolvedLanguage = language ?? template.baseLanguage;
    if (!template.availableLocales.includes(resolvedLanguage)) {
      throw new BadRequestException("emailTemplates.toast.previewLanguageUnavailable");
    }

    const primaryColor = await this.resolveTenantPrimaryColor(tenantId);
    const tenantLogoSrc =
      (await this.settingsService.getPlatformLogoUrl()) ?? DEFAULT_PLATFORM_LOGO_PATH;

    return renderTemplateContent({
      blocks: template.blocks,
      strings: template.strings,
      subject: template.subject,
      language: resolvedLanguage,
      baseLanguage: template.baseLanguage,
      primaryColor,
      tenantLogoSrc,
    });
  }

  async sendTestEmail(id: UUIDType, currentUser: CurrentUserType, language?: SupportedLanguages) {
    const template = await this.getTemplateById(id);

    const resolvedLanguage = language ?? template.baseLanguage;
    if (!template.availableLocales.includes(resolvedLanguage)) {
      throw new BadRequestException("emailTemplates.toast.previewLanguageUnavailable");
    }

    const { primaryColor } = await this.emailService.getDefaultEmailProperties(
      currentUser.tenantId,
    );

    const { subject, html } = await renderTemplateContent({
      blocks: template.blocks,
      strings: template.strings,
      subject: template.subject,
      language: resolvedLanguage,
      baseLanguage: template.baseLanguage,
      primaryColor,
      tenantLogoSrc: TENANT_LOGO_CID_SRC,
    });

    await this.emailService.sendEmailWithLogo(
      { to: currentUser.email, subject, html },
      { tenantId: currentUser.tenantId },
    );
  }

  private async resolveTenantPrimaryColor(tenantId: UUIDType): Promise<string> {
    if (!tenantId) return DEFAULT_TENANT_PRIMARY_COLOR;
    const { primaryColor } = await this.emailService.getDefaultEmailProperties(tenantId);
    return primaryColor;
  }

  async archiveTemplate(id: UUIDType) {
    await this.getTemplateById(id);

    const template = await this.repository.setStatus(
      id,
      EMAIL_TEMPLATE_STATUSES.ARCHIVED,
      new Date().toISOString(),
    );
    if (!template) throw new BadRequestException("emailTemplates.toast.archiveFailed");

    return template;
  }

  async deleteTemplate(id: UUIDType, tenantId: UUIDType) {
    const existing = await this.getTemplateById(id);
    const srcs = new Set(collectImageSrcs(existing.blocks));

    const deleted = await this.repository.deleteTemplate(id);
    if (!deleted) throw new BadRequestException("emailTemplates.toast.deleteFailed");

    await this.cleanupOrphanedImages(srcs, tenantId);
  }

  async deleteManyTemplates(ids: UUIDType[], tenantId: UUIDType) {
    if (ids.length === 0) throw new BadRequestException("emailTemplates.toast.deleteFailed");

    const blocksList = await this.repository.findBlocksByIds(ids);
    const allSrcs = new Set(blocksList.flatMap((blocks) => [...collectImageSrcs(blocks)]));

    const deleted = await this.repository.deleteManyTemplates(ids);
    if (deleted.length === 0) throw new NotFoundException("emailTemplates.toast.notFound");

    await this.cleanupOrphanedImages(allSrcs, tenantId);
  }

  async unarchiveTemplate(id: UUIDType) {
    await this.getTemplateById(id);

    const template = await this.repository.setStatus(id, EMAIL_TEMPLATE_STATUSES.DRAFT, null);
    if (!template) throw new BadRequestException("emailTemplates.toast.unarchiveFailed");

    return template;
  }

  private async ensureNameAvailable(name: string, excludeId?: UUIDType) {
    const existing = await this.findTemplateByName(name, excludeId);
    if (existing) {
      throw new ConflictException("emailTemplates.toast.nameAlreadyExists");
    }
  }

  private async createTemplateOrThrowNameConflict(
    input: CreateEmailNotificationTemplate & {
      name: string;
      subject: LocalizedText;
      blocks: EmailTemplateBlocks;
      strings: EmailTemplateStrings;
    },
  ) {
    try {
      return await this.repository.createTemplate(input);
    } catch (err) {
      if (isPostgresUniqueViolation(err, EMAIL_TEMPLATE_NAME_UNIQUE_INDEX)) {
        throw new ConflictException("emailTemplates.toast.nameAlreadyExists");
      }
      throw err;
    }
  }

  private async buildDuplicateName(sourceName: string) {
    const base = `Copy of ${sourceName}`;
    const candidates = [base, ...Array.from({ length: 20 }, (_, i) => `${base} (${i + 2})`)];
    const taken = new Set(await this.repository.findExistingNames(candidates));

    for (const candidate of candidates) {
      if (!taken.has(candidate)) return candidate;
    }

    let counter = candidates.length + 1;
    while (await this.findTemplateByName(`${base} (${counter})`)) counter += 1;
    return `${base} (${counter})`;
  }

  private validateLocales(
    baseLanguage: SupportedLanguages,
    availableLocales: SupportedLanguages[],
  ) {
    const supportedLanguageValues = Object.values(SUPPORTED_LANGUAGES) as SupportedLanguages[];

    for (const locale of availableLocales) {
      if (!supportedLanguageValues.includes(locale)) {
        throw new BadRequestException("emailTemplates.toast.invalidLocale");
      }
    }

    const uniqueLocales = new Set(availableLocales);
    if (uniqueLocales.size !== availableLocales.length) {
      throw new BadRequestException("emailTemplates.toast.duplicateLocales");
    }

    if (!uniqueLocales.has(baseLanguage)) {
      throw new BadRequestException("emailTemplates.toast.baseLanguageMissing");
    }
  }

  private rekeyBlockUuids(
    blocks: EmailTemplateBlocks,
    strings: EmailTemplateStrings,
  ): { blocks: EmailTemplateBlocks; strings: EmailTemplateStrings } {
    const idMap = new Map<string, string>();

    const rekey = (node: EmailTemplateBlocks): EmailTemplateBlocks => {
      const next: EmailTemplateBlocks = { ...node };
      if (node.attrs) {
        next.attrs = { ...node.attrs };
        const uuid = node.attrs.uuid;
        if (typeof uuid === "string") {
          const fresh = crypto.randomUUID();
          idMap.set(uuid, fresh);
          next.attrs.uuid = fresh;
        }
      }
      if (node.content) {
        next.content = node.content.map(rekey);
      }
      return next;
    };

    const rekeyedBlocks = rekey(blocks);
    const rekeyedStrings: EmailTemplateStrings = {};
    for (const [language, byUuid] of Object.entries(strings)) {
      if (!byUuid) continue;
      const remapped: Record<string, (typeof byUuid)[string]> = {};
      for (const [oldUuid, fragment] of Object.entries(byUuid)) {
        const newUuid = idMap.get(oldUuid);
        if (newUuid) remapped[newUuid] = fragment;
      }
      if (Object.keys(remapped).length > 0) {
        rekeyedStrings[language as keyof EmailTemplateStrings] = remapped;
      }
    }
    return { blocks: rekeyedBlocks, strings: rekeyedStrings };
  }

  private assertSafeRenderedBlockUrls(params: {
    blocks: EmailTemplateBlocks;
    strings: EmailTemplateStrings;
    availableLocales: SupportedLanguages[];
    baseLanguage: SupportedLanguages;
  }): void {
    for (const language of params.availableLocales) {
      assertSafeBlockUrls(
        flattenTranslationsForRender({
          blocks: params.blocks,
          strings: params.strings,
          language,
          baseLanguage: params.baseLanguage,
        }),
      );
    }
  }

  private assertPublishable(template: {
    name?: string;
    availableLocales: SupportedLanguages[];
    baseLanguage: SupportedLanguages;
    subject: LocalizedText;
    blocks: EmailTemplateBlocks;
    strings: EmailTemplateStrings;
  }): void {
    const diagnostics = computeEmailTemplateDiagnostics({
      name: template.name,
      availableLocales: template.availableLocales,
      baseLanguage: template.baseLanguage,
      subject: template.subject,
      blocks: template.blocks,
      strings: template.strings,
    });

    if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
      throw new BadRequestException("emailTemplates.toast.publishBlocked");
    }
  }

  private async cleanupOrphanedImages(
    srcs: Set<string>,
    tenantId: UUIDType,
    excludeTemplateId?: UUIDType,
  ): Promise<void> {
    if (srcs.size === 0) return;
    try {
      await this.cleanupQueue.enqueueImageCleanup({
        tenantId,
        srcs: [...srcs],
        excludeTemplateId,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to enqueue email template image cleanup: ${message}`);
    }
  }

  async purgeOrphanedImages({
    tenantId,
    srcs,
    excludeTemplateId,
  }: EmailTemplateImageCleanupJobData): Promise<void> {
    const keyList = [
      ...new Set(
        srcs
          .map((src) => extractTenantEmailTemplateImageFileKeyFromUrl(src, tenantId))
          .filter((key): key is string => Boolean(key)),
      ),
    ];
    const stillReferenced = await this.findReferencedImageKeys(
      keyList,
      tenantId,
      excludeTemplateId,
    );
    const orphaned = keyList.filter((key) => !stillReferenced.has(key));
    await Promise.all(
      orphaned.map(async (key) => {
        await this.fileService.deleteFile(key);
      }),
    );
  }

  private buildListConditions(filters: { status?: EmailTemplateStatus; name?: string }): SQL[] {
    const conditions: SQL[] = [];
    if (filters.status) conditions.push(eq(emailNotificationTemplates.status, filters.status));
    if (filters.name) conditions.push(ilike(emailNotificationTemplates.name, `%${filters.name}%`));

    return conditions;
  }

  private buildTemplateUpdates(
    input: UpdateEmailNotificationTemplate,
    blocks: EmailTemplateBlocks,
    strings: EmailTemplateStrings,
  ): Partial<typeof emailNotificationTemplates.$inferInsert> {
    const updates: Partial<typeof emailNotificationTemplates.$inferInsert> = {};

    if (input.name !== undefined) updates.name = input.name;
    if (input.baseLanguage !== undefined) updates.baseLanguage = input.baseLanguage;
    if (input.availableLocales !== undefined) updates.availableLocales = input.availableLocales;
    if (input.subject !== undefined) updates.subject = input.subject;
    updates.blocks = blocks;
    updates.strings = strings;

    return updates;
  }

  private async findTemplateByName(name: string, excludeId?: UUIDType) {
    const conditions: SQL[] = [eq(emailNotificationTemplates.name, name)];
    if (excludeId) conditions.push(ne(emailNotificationTemplates.id, excludeId));

    return this.repository.findByName(conditions);
  }

  private async buildNextAutoTemplateName() {
    const names = await this.repository.findAutoTemplateNames();
    const maxNumber = names.reduce((max, name) => {
      const match = EMAIL_TEMPLATE_AUTO_NAME_REGEX.exec(name);
      if (!match) return max;

      const value = Number(match[1]);
      return Number.isInteger(value) && value > max ? value : max;
    }, 0);

    return `Email template #${maxNumber + 1}`;
  }

  private async findReferencedImageKeys(
    keys: string[],
    tenantId: UUIDType,
    excludeTemplateId?: UUIDType,
  ): Promise<Set<string>> {
    const keySet = new Set(keys);
    if (keySet.size === 0) return new Set();

    const blocksList = await this.repository.findTemplateBlocks(excludeTemplateId);
    const out = new Set<string>();
    for (const blocks of blocksList) {
      for (const src of collectImageSrcs(blocks)) {
        const key = extractTenantEmailTemplateImageFileKeyFromUrl(src, tenantId);
        if (key && keySet.has(key)) out.add(key);
      }
    }

    return out;
  }
}
