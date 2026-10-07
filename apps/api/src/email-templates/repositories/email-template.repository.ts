import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { EMAIL_TEMPLATE_STATUSES, type PublishedEmailTemplate } from "@repo/email-templates";
import { and, count, desc, eq, isNull, or, sql, type SQL } from "drizzle-orm";

import { acquireAutomationLifecycleLock } from "src/automation-execution/utils/acquire-automation-lifecycle-lock";
import { DatabasePg, type UUIDType } from "src/common";
import { buildJsonbFieldWithMultipleEntries, mergeJsonbField } from "src/common/helpers/sqlHelpers";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import { emailTemplates } from "src/storage/schema";

import type { EmailTemplateRecord, EmailTemplateTranslationUpdate } from "../email-template.types";
import type { SupportedLanguages } from "@repo/shared";

@Injectable()
export class EmailTemplateRepository {
  constructor(
    @Inject(DB) private readonly database: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async withLockedEmailTemplate<T>(
    id: UUIDType,
    callback: (template: EmailTemplateRecord, transaction: DatabasePg) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (transaction) => {
      await acquireAutomationLifecycleLock(transaction);

      const template = await this.getEmailTemplateForUpdateOrThrow(transaction, id);

      return callback(template, transaction);
    });
  }

  findCustomEmailTemplatePageWithCount(
    offset: number,
    pageSize: number,
    search = "",
    language?: SupportedLanguages,
  ) {
    const matches = search
      ? or(
          ...[emailTemplates.name, emailTemplates.subject].map((field) => {
            const localized = this.localizationService.getLocalizedSqlField(
              field,
              language,
              emailTemplates,
            );

            return sql`position(lower(${search}) in lower(${localized})) > 0`;
          }),
        )
      : undefined;

    const filter = and(isNull(emailTemplates.deletedAt), matches);

    return this.database.transaction(
      async (transaction) => {
        const totalItems = await this.countCustomEmailTemplates(transaction, filter);
        const limit = Math.max(0, Math.min(pageSize, totalItems - offset));

        const templates =
          limit > 0
            ? await this.findCustomEmailTemplatePage(transaction, offset, limit, filter)
            : [];

        return { templates, totalItems };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async findEmailTemplateById(id: UUIDType) {
    const [template] = await this.database
      .select()
      .from(emailTemplates)
      .where(and(eq(emailTemplates.id, id), isNull(emailTemplates.deletedAt)));

    return template;
  }

  async insertEmailTemplate(values: typeof emailTemplates.$inferInsert) {
    const [template] = await this.database
      .insert(emailTemplates)
      .values({
        ...values,
        name: buildJsonbFieldWithMultipleEntries(values.name),
        subject: buildJsonbFieldWithMultipleEntries(values.subject),
        content: buildJsonbFieldWithMultipleEntries(values.content),
      })
      .returning();

    return template;
  }

  async insertSampleEmailTemplateIfAbsent(values: typeof emailTemplates.$inferInsert) {
    await this.database
      .insert(emailTemplates)
      .values({
        ...values,
        name: buildJsonbFieldWithMultipleEntries(values.name),
        subject: buildJsonbFieldWithMultipleEntries(values.subject),
        content: buildJsonbFieldWithMultipleEntries(values.content),
      })
      .onConflictDoNothing({ target: emailTemplates.id });
  }

  async softDeleteEmailTemplate(id: UUIDType) {
    const now = new Date().toISOString();

    await this.database
      .update(emailTemplates)
      .set({
        deletedAt: now,
        status: EMAIL_TEMPLATE_STATUSES.ARCHIVED,
        archivedAt: now,
      })
      .where(and(eq(emailTemplates.id, id), isNull(emailTemplates.deletedAt)));
  }

  async updateEmailTemplate(id: UUIDType, values: Partial<typeof emailTemplates.$inferInsert>) {
    const [template] = await this.database
      .update(emailTemplates)
      .set(values)
      .where(and(eq(emailTemplates.id, id), isNull(emailTemplates.deletedAt)))
      .returning();

    return template;
  }

  async removeEmailTemplateLanguage(
    id: UUIDType,
    language: SupportedLanguages,
    availableLocales: SupportedLanguages[],
  ) {
    const [template] = await this.database
      .update(emailTemplates)
      .set({
        name: sql`${emailTemplates.name} - ${language}`,
        subject: sql`${emailTemplates.subject} - ${language}`,
        content: sql`${emailTemplates.content} - ${language}`,
        availableLocales,
        updatedAt: new Date().toISOString(),
      })
      .where(and(eq(emailTemplates.id, id), isNull(emailTemplates.deletedAt)))
      .returning();

    return template;
  }

  async updateEmailTemplateTranslations(id: UUIDType, values: EmailTemplateTranslationUpdate) {
    const { name, subject, content, ...metadata } = values;

    const [template] = await this.database
      .update(emailTemplates)
      .set({
        ...metadata,
        name: this.mergeEmailTemplateTextTranslations(emailTemplates.name, name),
        subject: this.mergeEmailTemplateTextTranslations(emailTemplates.subject, subject),
        content: content
          ? mergeJsonbField(emailTemplates.content, buildJsonbFieldWithMultipleEntries(content))
          : undefined,
      })
      .where(and(eq(emailTemplates.id, id), isNull(emailTemplates.deletedAt)))
      .returning();

    return template;
  }

  private mergeEmailTemplateTextTranslations(
    column: typeof emailTemplates.name | typeof emailTemplates.subject,
    translations: EmailTemplateTranslationUpdate["name"],
  ) {
    if (!translations) {
      return undefined;
    }

    return Object.entries(translations).reduce(
      (field, [language, value]) => {
        const updatedFields = this.localizationService.updateLocalizableFields(
          ["text"],
          { text: field },
          { text: value },
          language,
          true,
        );

        return (updatedFields.text as SQL | undefined) ?? field;
      },
      sql`${column}`,
    );
  }

  async findPublishedEmailTemplates() {
    return this.database
      .select()
      .from(emailTemplates)
      .where(
        and(
          isNull(emailTemplates.deletedAt),
          eq(emailTemplates.status, EMAIL_TEMPLATE_STATUSES.PUBLISHED),
        ),
      );
  }

  async publishEmailTemplate(id: UUIDType, publication: PublishedEmailTemplate) {
    const now = new Date().toISOString();

    const [template] = await this.database
      .update(emailTemplates)
      .set({
        status: EMAIL_TEMPLATE_STATUSES.PUBLISHED,
        publishedAt: now,
        archivedAt: null,
        updatedAt: now,
        publication,
        publicationVersion: sql`${emailTemplates.publicationVersion} + 1`,
      })
      .where(and(eq(emailTemplates.id, id), isNull(emailTemplates.deletedAt)))
      .returning();

    return { template, archivedTemplates: [] as EmailTemplateRecord[] };
  }

  private async getEmailTemplateForUpdateOrThrow(transaction: DatabasePg, id: UUIDType) {
    const [template] = await transaction
      .select()
      .from(emailTemplates)
      .where(and(eq(emailTemplates.id, id), isNull(emailTemplates.deletedAt)))
      .for("update");

    if (!template) {
      throw new NotFoundException("emailTemplates.errors.notFound");
    }

    return template;
  }

  private async countCustomEmailTemplates(transaction: DatabasePg, filter?: SQL) {
    const [{ totalItems }] = await transaction
      .select({ totalItems: count() })
      .from(emailTemplates)
      .where(filter);

    return totalItems;
  }

  private findCustomEmailTemplatePage(
    transaction: DatabasePg,
    offset: number,
    limit: number,
    filter?: SQL,
  ) {
    return transaction
      .select()
      .from(emailTemplates)
      .where(filter)
      .orderBy(desc(emailTemplates.updatedAt), desc(emailTemplates.id))
      .offset(offset)
      .limit(limit);
  }
}
