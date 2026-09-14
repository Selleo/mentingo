import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { EMAIL_TEMPLATE_STATUSES, type EmailTemplateEvent } from "@repo/email-templates";
import { and, count, desc, eq, ne, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { DB } from "src/storage/db/db.providers";
import { emailTemplates } from "src/storage/schema";

export type EmailTemplateRecord = typeof emailTemplates.$inferSelect;

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
    const [template] = await this.db.select().from(emailTemplates).where(eq(emailTemplates.id, id));
    return template;
  }

  async findPublishedEmailTemplate(event: EmailTemplateEvent) {
    const [template] = await this.db
      .select()
      .from(emailTemplates)
      .where(
        and(
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

  async updateEmailTemplate(id: UUIDType, values: Partial<typeof emailTemplates.$inferInsert>) {
    const [template] = await this.db
      .update(emailTemplates)
      .set(values)
      .where(eq(emailTemplates.id, id))
      .returning();
    return template;
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
        .where(eq(emailTemplates.id, id))
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
      .where(eq(emailTemplates.id, id));

    if (!template) throw new NotFoundException("emailTemplates.errors.notFound");
    return template.event;
  }

  private async getEmailTemplateForUpdateOrThrow(transaction: DatabasePg, id: UUIDType) {
    const [template] = await transaction
      .select()
      .from(emailTemplates)
      .where(eq(emailTemplates.id, id))
      .for("update");

    if (!template) throw new NotFoundException("emailTemplates.errors.notFound");
    return template;
  }

  private async countEmailTemplateOverrides(transaction: DatabasePg) {
    const [{ totalItems }] = await transaction.select({ totalItems: count() }).from(emailTemplates);
    return totalItems;
  }

  private findEmailTemplateOverridePage(transaction: DatabasePg, offset: number, limit: number) {
    return transaction
      .select()
      .from(emailTemplates)
      .orderBy(desc(emailTemplates.updatedAt), desc(emailTemplates.id))
      .offset(offset)
      .limit(limit);
  }
}
