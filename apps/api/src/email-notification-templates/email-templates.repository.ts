import { Inject, Injectable } from "@nestjs/common";
import { EMAIL_TEMPLATE_NODE_TYPES } from "@repo/shared";
import { and, count, desc, eq, ilike, inArray, ne, or, sql, type SQL } from "drizzle-orm";

import { DatabasePg } from "src/common";
import { addPagination } from "src/common/pagination";
import { DB } from "src/storage/db/db.providers";
import { emailNotificationTemplates } from "src/storage/schema";

import type { CreateEmailNotificationTemplate } from "./schemas/createEmailNotificationTemplate.schema";
import type { UpdateEmailNotificationTemplate } from "./schemas/updateEmailNotificationTemplate.schema";
import type { EmailTemplateBlocks, EmailTemplateStatus, EmailTemplateStrings } from "@repo/shared";
import type { UUIDType } from "src/common";

const buildDefaultBlocks = (): EmailTemplateBlocks => ({
  type: EMAIL_TEMPLATE_NODE_TYPES.DOC,
  content: [{ type: EMAIL_TEMPLATE_NODE_TYPES.PARAGRAPH, attrs: { uuid: crypto.randomUUID() } }],
});

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
    const rows = await this.db
      .delete(emailNotificationTemplates)
      .where(inArray(emailNotificationTemplates.id, ids))
      .returning({ id: emailNotificationTemplates.id });

    return rows;
  }

  async createTemplate(input: CreateEmailNotificationTemplate) {
    const [row] = await this.db
      .insert(emailNotificationTemplates)
      .values({
        name: input.name,
        baseLanguage: input.baseLanguage,
        availableLocales: input.availableLocales,
        subject: input.subject ?? {},
        blocks: (input.blocks as EmailTemplateBlocks | undefined) ?? buildDefaultBlocks(),
        strings: (input.strings as EmailTemplateStrings | undefined) ?? {},
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

    const [row] = await this.db
      .update(emailNotificationTemplates)
      .set(updates)
      .where(eq(emailNotificationTemplates.id, id))
      .returning();

    return row;
  }

  async findReferencedImageSrcs(srcs: string[], excludeId?: UUIDType): Promise<Set<string>> {
    if (srcs.length === 0) return new Set();
    const conditions: SQL[] = [
      or(
        ...srcs.map(
          (src) =>
            sql`strpos(${emailNotificationTemplates.blocks}::text, ${JSON.stringify(src)}) > 0`,
        ),
      )!,
    ];
    if (excludeId) conditions.push(ne(emailNotificationTemplates.id, excludeId));
    const rows = await this.db
      .select({ blocks: sql<string>`${emailNotificationTemplates.blocks}::text` })
      .from(emailNotificationTemplates)
      .where(and(...conditions));
    const out = new Set<string>();
    for (const src of srcs) {
      const needle = JSON.stringify(src);
      if (rows.some((r) => r.blocks.includes(needle))) out.add(src);
    }
    return out;
  }

  async findMaxAutoTemplateNumber(): Promise<number> {
    const result = await this.db.execute(
      sql`SELECT COALESCE(MAX((substring(name FROM '^Email template #(\d+)$'))::int), 0) AS max
          FROM ${emailNotificationTemplates}
          WHERE name ~ '^Email template #\d+$'`,
    );
    const rows = result as unknown as Array<{ max?: number | string }>;
    const first = rows[0];
    return Number(first?.max ?? 0);
  }
}
