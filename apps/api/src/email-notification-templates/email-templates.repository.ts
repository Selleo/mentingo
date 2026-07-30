import { Inject, Injectable } from "@nestjs/common";
import { and, count, desc, eq, ilike, inArray, ne, sql, type SQL } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { addPagination } from "src/common/pagination";
import { DB } from "src/storage/db/db.providers";
import { emailNotificationTemplates } from "src/storage/schema";

import { buildDefaultEmailTemplateBlocks } from "./utils/buildDefaultEmailTemplateBlocks";
import {
  collectImageSrcs,
  extractTenantEmailTemplateImageFileKeyFromUrl,
} from "./utils/emailTemplateImageUrl";

import type { CreateEmailNotificationTemplate } from "./schemas/createEmailNotificationTemplate.schema";
import type { UpdateEmailNotificationTemplate } from "./schemas/updateEmailNotificationTemplate.schema";
import type { EmailTemplateBlocks, EmailTemplateStatus, EmailTemplateStrings } from "@repo/shared";
import type { UUIDType } from "src/common";

@Injectable()
export class EmailNotificationTemplatesRepository {
  constructor(@Inject(DB) private readonly db: DatabasePg) {}

  async listTemplates(
    pagination: { page: number; perPage: number },
    filters: { status?: EmailTemplateStatus; name?: string },
  ) {
    const conditions: SQL[] = [];
    if (filters.status) conditions.push(eq(emailNotificationTemplates.status, filters.status));
    if (filters.name) conditions.push(ilike(emailNotificationTemplates.name, `%${filters.name}%`));

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
    return this.db.transaction(async (trx) => {
      return trx
        .delete(emailNotificationTemplates)
        .where(inArray(emailNotificationTemplates.id, ids))
        .returning({ id: emailNotificationTemplates.id });
    });
  }

  async createTemplate(input: CreateEmailNotificationTemplate & { name: string }) {
    const [row] = await this.db
      .insert(emailNotificationTemplates)
      .values({
        name: input.name,
        baseLanguage: input.baseLanguage,
        availableLocales: input.availableLocales,
        subject: input.subject ?? {},
        blocks:
          (input.blocks as EmailTemplateBlocks | undefined) ??
          buildDefaultEmailTemplateBlocks(input.baseLanguage),
        strings: (input.strings as EmailTemplateStrings | undefined) ?? {},
      })
      .returning();

    return row;
  }

  async deleteTemplate(id: UUIDType) {
    return this.db.transaction(async (trx) => {
      const [row] = await trx
        .delete(emailNotificationTemplates)
        .where(eq(emailNotificationTemplates.id, id))
        .returning({ id: emailNotificationTemplates.id });

      return row;
    });
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
    if (ids.length === 0) return [];

    const rows = await this.db
      .select({ blocks: emailNotificationTemplates.blocks })
      .from(emailNotificationTemplates)
      .where(inArray(emailNotificationTemplates.id, ids));

    return rows.map((r) => r.blocks as EmailTemplateBlocks);
  }

  async findByName(name: string, excludeId?: UUIDType) {
    const conditions: SQL[] = [eq(emailNotificationTemplates.name, name)];
    if (excludeId) conditions.push(ne(emailNotificationTemplates.id, excludeId));

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
    baseLanguage: typeof emailNotificationTemplates.$inferSelect.baseLanguage;
    availableLocales: typeof emailNotificationTemplates.$inferSelect.availableLocales;
    subject: typeof emailNotificationTemplates.$inferSelect.subject;
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
    input: UpdateEmailNotificationTemplate & {
      blocks?: EmailTemplateBlocks;
      strings?: EmailTemplateStrings;
    },
  ) {
    const updates: Partial<typeof emailNotificationTemplates.$inferInsert> = {};

    if (input.name !== undefined) updates.name = input.name;
    if (input.baseLanguage !== undefined) updates.baseLanguage = input.baseLanguage;
    if (input.availableLocales !== undefined) updates.availableLocales = input.availableLocales;
    if (input.subject !== undefined) updates.subject = input.subject;
    if (input.blocks !== undefined) updates.blocks = input.blocks as EmailTemplateBlocks;
    if (input.strings !== undefined) updates.strings = input.strings as EmailTemplateStrings;

    return this.db.transaction(async (trx) => {
      const [row] = await trx
        .update(emailNotificationTemplates)
        .set(updates)
        .where(eq(emailNotificationTemplates.id, id))
        .returning();

      return row;
    });
  }

  async findReferencedImageKeys(
    keys: string[],
    tenantId: UUIDType,
    excludeId?: UUIDType,
  ): Promise<Set<string>> {
    const keySet = new Set(keys);
    if (keySet.size === 0) return new Set();

    const conditions: SQL[] = [];
    if (excludeId) conditions.push(ne(emailNotificationTemplates.id, excludeId));
    const rows = await this.db
      .select({ blocks: emailNotificationTemplates.blocks })
      .from(emailNotificationTemplates)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const out = new Set<string>();
    for (const row of rows) {
      for (const src of collectImageSrcs(row.blocks as EmailTemplateBlocks)) {
        const key = extractTenantEmailTemplateImageFileKeyFromUrl(src, tenantId);
        if (key && keySet.has(key)) out.add(key);
      }
    }
    return out;
  }

  async findMaxAutoTemplateNumber(): Promise<number> {
    const result = await this.db.execute(
      sql`SELECT COALESCE(MAX((substring(name FROM '^Email template #([0-9]+)$'))::int), 0) AS max
          FROM ${emailNotificationTemplates}
          WHERE name ~ '^Email template #[0-9]+$'`,
    );
    const rows = result as unknown as Array<{ max?: number | string }>;
    const first = rows[0];
    return Number(first?.max ?? 0);
  }
}
