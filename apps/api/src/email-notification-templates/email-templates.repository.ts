import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, ilike, inArray, ne, type SQL } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { addPagination } from "src/common/pagination";
import { DB } from "src/storage/db/db.providers";
import { emailNotificationTemplates } from "src/storage/schema";

import type {
  EmailTemplateBlocks,
  EmailTemplateStatus,
  EmailTemplateStrings,
  LocalizedText,
  SupportedLanguages,
} from "@repo/shared";
import type { UUIDType } from "src/common";

type CreateEmailNotificationTemplateRow = {
  name: string;
  baseLanguage: SupportedLanguages;
  availableLocales: SupportedLanguages[];
  subject: LocalizedText;
  blocks: EmailTemplateBlocks;
  strings: EmailTemplateStrings;
};

@Injectable()
export class EmailNotificationTemplatesRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async listTemplates(pagination: { page: number; perPage: number }, conditions: SQL[] = []) {
    return this.db.transaction(async (trx) => {
      const templatesQuery = trx
        .select()
        .from(emailNotificationTemplates)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(emailNotificationTemplates.updatedAt))
        .$dynamic();

      const data = await addPagination(templatesQuery, pagination.page, pagination.perPage);

      const [{ totalItems }] = await trx
        .select({ totalItems: count() })
        .from(emailNotificationTemplates)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return {
        data,
        pagination: { ...pagination, totalItems },
      };
    });
  }

  async deleteManyTemplates(ids: UUIDType[]) {
    return this.db
      .delete(emailNotificationTemplates)
      .where(inArray(emailNotificationTemplates.id, ids))
      .returning({ id: emailNotificationTemplates.id });
  }

  async createTemplate(input: CreateEmailNotificationTemplateRow) {
    const [row] = await this.db
      .insert(emailNotificationTemplates)
      .values({
        name: input.name,
        baseLanguage: input.baseLanguage,
        availableLocales: input.availableLocales,
        subject: input.subject,
        blocks: input.blocks,
        strings: input.strings,
      })
      .returning();

    return row;
  }

  async deleteTemplate(id: UUIDType) {
    const [row] = await this.db
      .delete(emailNotificationTemplates)
      .where(eq(emailNotificationTemplates.id, id))
      .returning({ id: emailNotificationTemplates.id });

    return row;
  }

  async findById(id: UUIDType) {
    const [row] = await this.db
      .select()
      .from(emailNotificationTemplates)
      .where(eq(emailNotificationTemplates.id, id))
      .limit(1);

    return row;
  }

  async findBlocksByIds(ids: UUIDType[]): Promise<EmailTemplateBlocks[]> {
    const rows = await this.db
      .select({ blocks: emailNotificationTemplates.blocks })
      .from(emailNotificationTemplates)
      .where(inArray(emailNotificationTemplates.id, ids));

    return rows.map((row) => row.blocks);
  }

  async findByName(conditions: SQL[]) {
    const [row] = await this.db
      .select({ id: emailNotificationTemplates.id })
      .from(emailNotificationTemplates)
      .where(and(...conditions))
      .limit(1);

    return row;
  }

  async findExistingNames(names: string[]) {
    if (names.length === 0) return [] as string[];

    const rows = await this.db
      .select({ name: emailNotificationTemplates.name })
      .from(emailNotificationTemplates)
      .where(inArray(emailNotificationTemplates.name, names));

    return rows.map((row) => row.name);
  }

  async duplicateFrom(source: {
    name: string;
    baseLanguage: SupportedLanguages;
    availableLocales: SupportedLanguages[];
    subject: LocalizedText;
    blocks: EmailTemplateBlocks;
    strings: EmailTemplateStrings;
  }) {
    const [row] = await this.db
      .insert(emailNotificationTemplates)
      .values({
        name: source.name,
        baseLanguage: source.baseLanguage,
        availableLocales: source.availableLocales,
        subject: source.subject,
        blocks: source.blocks,
        strings: source.strings,
      })
      .returning();

    return row;
  }

  async setStatus(id: UUIDType, status: EmailTemplateStatus, archivedAt: string | null) {
    const [row] = await this.db
      .update(emailNotificationTemplates)
      .set({ status, archivedAt })
      .where(eq(emailNotificationTemplates.id, id))
      .returning();

    return row;
  }

  async updateTemplate(
    id: UUIDType,
    updates: Partial<typeof emailNotificationTemplates.$inferInsert>,
  ) {
    const [row] = await this.db
      .update(emailNotificationTemplates)
      .set(updates)
      .where(eq(emailNotificationTemplates.id, id))
      .returning();

    return row;
  }

  async findTemplateBlocks(excludeId?: UUIDType): Promise<EmailTemplateBlocks[]> {
    const conditions: SQL[] = [];
    if (excludeId) conditions.push(ne(emailNotificationTemplates.id, excludeId));

    const rows = await this.db
      .select({ blocks: emailNotificationTemplates.blocks })
      .from(emailNotificationTemplates)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    return rows.map((row) => row.blocks);
  }

  async findAutoTemplateNames(): Promise<string[]> {
    const rows = await this.db
      .select({ name: emailNotificationTemplates.name })
      .from(emailNotificationTemplates)
      .where(ilike(emailNotificationTemplates.name, "Email template #%"));

    return rows.map((row) => row.name);
  }
}
