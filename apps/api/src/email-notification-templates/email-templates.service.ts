import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { EMAIL_TEMPLATE_STATUSES, SUPPORTED_LANGUAGES } from "@repo/shared";

import { EmailService } from "src/common/emails/emails.service";
import { parsePagination } from "src/common/pagination";
import { dbAls } from "src/storage/db/db-als.store";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";

import { EmailTemplateImageService } from "./email-template-image.service";
import { EmailNotificationTemplatesRepository } from "./email-templates.repository";
import { assertSafeBlockUrls } from "./utils/assertSafeBlockUrls";
import { collectImageSrcs, extractFileKeyFromImageUrl } from "./utils/emailTemplateImageUrl";
import { pruneOrphanStrings } from "./utils/pruneOrphanStrings";
import { renderTemplateContent } from "./utils/renderTemplateContent";

import type { CreateEmailNotificationTemplate } from "./schemas/createEmailNotificationTemplate.schema";
import type { UpdateEmailNotificationTemplate } from "./schemas/updateEmailNotificationTemplate.schema";
import type {
  EmailTemplateBlocks,
  EmailTemplateStatus,
  EmailTemplateStrings,
  SupportedLanguages,
} from "@repo/shared";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";

const EMAIL_TEMPLATES_PAGE_SIZE = 20;

@Injectable()
export class EmailNotificationTemplatesService {
  private readonly logger = new Logger(EmailNotificationTemplatesService.name);

  constructor(
    private readonly repository: EmailNotificationTemplatesRepository,
    private readonly imageService: EmailTemplateImageService,
    private readonly emailService: EmailService,
    private readonly tenantRunner: TenantDbRunnerService,
  ) {}

  async listTemplates(
    paginationQuery: { page?: number; perPage?: number },
    filters: { status?: EmailTemplateStatus; name?: string },
  ) {
    const { page, perPage } = parsePagination(paginationQuery.page, paginationQuery.perPage, {
      perPage: EMAIL_TEMPLATES_PAGE_SIZE,
    });

    return this.repository.listTemplates(
      { page, perPage: Math.min(perPage, EMAIL_TEMPLATES_PAGE_SIZE) },
      filters,
    );
  }

  async createTemplate(input: CreateEmailNotificationTemplate) {
    this.validateLocales(input.baseLanguage, input.availableLocales);
    if (input.blocks) assertSafeBlockUrls(input.blocks as EmailTemplateBlocks);
    await this.ensureNameAvailable(input.name);

    const template = await this.repository.createTemplate(input);
    if (!template) throw new BadRequestException("emailTemplates.toast.createFailed");

    return template;
  }

  async getTemplateById(id: UUIDType) {
    const template = await this.repository.findById(id);
    if (!template) throw new NotFoundException("emailTemplates.toast.notFound");

    return template;
  }

  async updateTemplate(id: UUIDType, input: UpdateEmailNotificationTemplate) {
    const existing = await this.getTemplateById(id);

    if (input.baseLanguage !== undefined || input.availableLocales !== undefined) {
      this.validateLocales(
        input.baseLanguage ?? existing.baseLanguage,
        input.availableLocales ?? existing.availableLocales,
      );
    }

    if (input.name !== undefined && input.name !== existing.name) {
      await this.ensureNameAvailable(input.name, id);
    }

    const nextBlocks = (input.blocks as EmailTemplateBlocks | undefined) ?? existing.blocks;
    if (input.blocks !== undefined) assertSafeBlockUrls(nextBlocks);
    const nextStrings = (input.strings as EmailTemplateStrings | undefined) ?? existing.strings;
    const pruned = pruneOrphanStrings(nextBlocks, nextStrings);

    const prevSrcs = new Set(collectImageSrcs(existing.blocks));
    const nextSrcs = new Set(collectImageSrcs(nextBlocks));
    const removedSrcs = new Set([...prevSrcs].filter((s) => !nextSrcs.has(s)));

    const template = await this.repository.updateTemplate(id, {
      ...input,
      blocks: nextBlocks,
      strings: pruned,
    });
    if (!template) throw new BadRequestException("emailTemplates.toast.updateFailed");

    this.cleanupOrphanedImages(removedSrcs, id);

    return template;
  }

  async publishTemplate(id: UUIDType) {
    await this.getTemplateById(id);

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

  async previewTemplate(id: UUIDType, language?: SupportedLanguages) {
    const template = await this.getTemplateById(id);

    const resolvedLanguage = language ?? template.baseLanguage;
    if (!template.availableLocales.includes(resolvedLanguage)) {
      throw new BadRequestException("emailTemplates.toast.previewLanguageUnavailable");
    }

    return renderTemplateContent({
      blocks: template.blocks,
      strings: template.strings,
      subject: template.subject,
      language: resolvedLanguage,
      baseLanguage: template.baseLanguage,
    });
  }

  async sendTestEmail(id: UUIDType, currentUser: CurrentUserType, language?: SupportedLanguages) {
    const template = await this.getTemplateById(id);

    const resolvedLanguage = language ?? template.baseLanguage;
    if (!template.availableLocales.includes(resolvedLanguage)) {
      throw new BadRequestException("emailTemplates.toast.previewLanguageUnavailable");
    }

    const { subject, html } = await renderTemplateContent({
      blocks: template.blocks,
      strings: template.strings,
      subject: template.subject,
      language: resolvedLanguage,
      baseLanguage: template.baseLanguage,
    });

    await this.emailService.sendEmailWithLogo(
      { to: currentUser.email, subject, html },
      { tenantId: currentUser.tenantId },
    );
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

  async deleteTemplate(id: UUIDType) {
    const existing = await this.getTemplateById(id);
    const srcs = new Set(collectImageSrcs(existing.blocks));

    const deleted = await this.repository.deleteTemplate(id);
    if (!deleted) throw new BadRequestException("emailTemplates.toast.deleteFailed");

    this.cleanupOrphanedImages(srcs);
  }

  async deleteManyTemplates(ids: UUIDType[]) {
    if (ids.length === 0) throw new BadRequestException("emailTemplates.toast.deleteFailed");

    const blocksList = await this.repository.findBlocksByIds(ids);
    const allSrcs = new Set(blocksList.flatMap((blocks) => [...collectImageSrcs(blocks)]));

    const deleted = await this.repository.deleteManyTemplates(ids);
    if (deleted.length === 0) throw new NotFoundException("emailTemplates.toast.notFound");

    this.cleanupOrphanedImages(allSrcs);
  }

  async unarchiveTemplate(id: UUIDType) {
    await this.getTemplateById(id);

    const template = await this.repository.setStatus(id, EMAIL_TEMPLATE_STATUSES.DRAFT, null);
    if (!template) throw new BadRequestException("emailTemplates.toast.unarchiveFailed");

    return template;
  }

  private async ensureNameAvailable(name: string, excludeId?: UUIDType) {
    const existing = await this.repository.findByName(name, excludeId);
    if (existing) {
      throw new ConflictException("emailTemplates.toast.nameAlreadyExists");
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
    while (await this.repository.findByName(`${base} (${counter})`)) counter += 1;
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

  async getNextAutoTemplateName(): Promise<string> {
    const max = await this.repository.findMaxAutoTemplateNumber();
    return `Email template #${max + 1}`;
  }

  private cleanupOrphanedImages(srcs: Set<string>, excludeTemplateId?: UUIDType): void {
    if (srcs.size === 0) return;
    const tenantId = dbAls.getStore()?.tenantId;
    if (!tenantId) {
      this.logger.warn("Skipping orphaned image cleanup: no tenant context");
      return;
    }
    void this.tenantRunner
      .runWithTenant(tenantId, () => this.purgeOrphanedImages(srcs, excludeTemplateId))
      .catch((err) => this.logger.error("Failed to delete orphaned template images", err));
  }

  private async purgeOrphanedImages(
    srcs: Set<string>,
    excludeTemplateId?: UUIDType,
  ): Promise<void> {
    const srcList = [...srcs];
    const stillReferenced = await this.repository.findReferencedImageSrcs(
      srcList,
      excludeTemplateId,
    );
    const orphaned = srcList.filter((src) => !stillReferenced.has(src));
    await Promise.all(
      orphaned.map(async (src) => {
        const key = extractFileKeyFromImageUrl(src);
        if (key) await this.imageService.deleteByKey(key);
      }),
    );
  }
}
