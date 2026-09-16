import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { EMAIL_TEMPLATE_STATUSES, type EmailTemplateEvent } from "@repo/email-templates";
import { and, count, desc, eq, isNull, ne, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { mergeJsonbField, setJsonbField } from "src/common/helpers/sqlHelpers";
import { DB } from "src/storage/db/db.providers";
import { emailTemplates } from "src/storage/schema";

import type { EmailTemplateRecord, EmailTemplateTranslationUpdate } from "../email-template.types";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

@Injectable()
export class EmailTemplateRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async withLockedEmailTemplate<T>(
    id: UUIDType,
    callback: (template: EmailTemplateRecord) => Promise<T>,
  ): Promise<T> {
    return this.db.transaction(async (transaction) => {
      const event = await this.getEmailTemplateEventOrThrow(transaction, id);
      await this.lockEmailTemplatePublication(transaction, event);

      const template = await this.getEmailTemplateForUpdateOrThrow(transaction, id);
      return callback(template);
    });
  }

  findEmailTemplateOverridePageWithTotal(offset: number, pageSize: number) {
    return this.db.transaction(
      async (transaction) => {
        const totalItems = await this.countEmailTemplateOverrides(transaction);
        const limit = Math.max(0, Math.min(pageSize, totalItems - offset));
        const templates =
          limit > 0 ? await this.findEmailTemplateOverridePage(transaction, offset, limit) : [];

        return { templates, totalItems };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }

  async findEmailTemplateById(id: UUIDType) {
    const [template] = await this.db
      .select()
      .from(emailTemplates)
      .where(and(eq(emailTemplates.id, id), isNull(emailTemplates.deletedAt)));

    return template;
  }

  async findPublishedEmailTemplate(event: EmailTemplateEvent) {
    const [template] = await this.db
      .select()
      .from(emailTemplates)
      .where(
        and(
          isNull(emailTemplates.deletedAt),
          eq(emailTemplates.event, event),
          eq(emailTemplates.status, EMAIL_TEMPLATE_STATUSES.PUBLISHED),
        ),
      )
      .limit(1);
    return template;
  }

  async createEmailTemplate(values: typeof emailTemplates.$inferInsert) {
    const [template] = await this.db.insert(emailTemplates).values(values).returning();
    return template;
  }

  async createExampleEmailTemplateIfMissing(values: typeof emailTemplates.$inferInsert) {
    await this.db
      .insert(emailTemplates)
      .values(values)
      .onConflictDoNothing({ target: emailTemplates.id });
  }

  async deleteEmailTemplate(id: UUIDType) {
    const now = new Date().toISOString();

    await this.db
      .update(emailTemplates)
      .set({
        deletedAt: now,
        status: EMAIL_TEMPLATE_STATUSES.ARCHIVED,
        archivedAt: now,
      })
      .where(and(eq(emailTemplates.id, id), isNull(emailTemplates.deletedAt)));
  }

  async updateEmailTemplate(id: UUIDType, values: Partial<typeof emailTemplates.$inferInsert>) {
    const [template] = await this.db
      .update(emailTemplates)
      .set(values)
      .where(and(eq(emailTemplates.id, id), isNull(emailTemplates.deletedAt)))
      .returning();
    return template;
  }

  async updateEmailTemplateTranslations(id: UUIDType, values: EmailTemplateTranslationUpdate) {
    const { name, subject, content, ...metadata } = values;

    const [template] = await this.db
      .update(emailTemplates)
      .set({
        ...metadata,
        name: this.patchLocalizedText(emailTemplates.name, name),
        subject: this.patchLocalizedText(emailTemplates.subject, subject),
        content: content
          ? mergeJsonbField(
              this.getLocalizedJsonObject(emailTemplates.content),
              sql`${content}::jsonb`,
            )
          : undefined,
      })
      .where(and(eq(emailTemplates.id, id), isNull(emailTemplates.deletedAt)))
      .returning();
    return template;
  }

  private patchLocalizedText(
    column: typeof emailTemplates.name | typeof emailTemplates.subject,
    translations: EmailTemplateTranslationUpdate["name"],
  ) {
    if (!translations) return undefined;

    return Object.entries(translations).reduce(
      (field, [language, value]) => setJsonbField(field, language, value, true, true) ?? field,
      this.getLocalizedJsonObject(column),
    );
  }

  private getLocalizedJsonObject(column: AnyPgColumn) {
    return sql`CASE WHEN jsonb_typeof(${column}) = 'string'
      THEN (${column} #>> '{}')::jsonb ELSE ${column} END`;
  }

  publishEmailTemplate(id: UUIDType, event: EmailTemplateEvent) {
    return this.db.transaction(async (transaction) => {
      await this.lockEmailTemplatePublication(transaction, event);

      const now = new Date().toISOString();
      await transaction
        .update(emailTemplates)
        .set({
          status: EMAIL_TEMPLATE_STATUSES.ARCHIVED,
          archivedAt: now,
          updatedAt: now,
        })
        .where(
          and(
            isNull(emailTemplates.deletedAt),
            eq(emailTemplates.event, event),
            eq(emailTemplates.status, EMAIL_TEMPLATE_STATUSES.PUBLISHED),
            ne(emailTemplates.id, id),
          ),
        );

      const [template] = await transaction
        .update(emailTemplates)
        .set({
          status: EMAIL_TEMPLATE_STATUSES.PUBLISHED,
          publishedAt: now,
          archivedAt: null,
          updatedAt: now,
        })
        .where(and(eq(emailTemplates.id, id), isNull(emailTemplates.deletedAt)))
        .returning();

      return template;
    });
  }

  private async lockEmailTemplatePublication(transaction: DatabasePg, event: EmailTemplateEvent) {
    await transaction.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext(current_setting('app.tenant_id', true) || ':' || ${event}))`,
    );
  }

  private async getEmailTemplateEventOrThrow(transaction: DatabasePg, id: UUIDType) {
    const [template] = await transaction
      .select({ event: emailTemplates.event })
      .from(emailTemplates)
      .where(and(eq(emailTemplates.id, id), isNull(emailTemplates.deletedAt)));

    if (!template) throw new NotFoundException("emailTemplates.errors.notFound");
    return template.event;
  }

  private async getEmailTemplateForUpdateOrThrow(transaction: DatabasePg, id: UUIDType) {
    const [template] = await transaction
      .select()
      .from(emailTemplates)
      .where(and(eq(emailTemplates.id, id), isNull(emailTemplates.deletedAt)))
      .for("update");

    if (!template) throw new NotFoundException("emailTemplates.errors.notFound");
    return template;
  }

  private async countEmailTemplateOverrides(transaction: DatabasePg) {
    const [{ totalItems }] = await transaction
      .select({ totalItems: count() })
      .from(emailTemplates)
      .where(isNull(emailTemplates.deletedAt));
    return totalItems;
  }

  private findEmailTemplateOverridePage(transaction: DatabasePg, offset: number, limit: number) {
    return transaction
      .select()
      .from(emailTemplates)
      .where(isNull(emailTemplates.deletedAt))
      .orderBy(desc(emailTemplates.updatedAt), desc(emailTemplates.id))
      .offset(offset)
      .limit(limit);
  }
}
