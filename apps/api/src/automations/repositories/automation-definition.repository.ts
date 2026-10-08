import { Inject, Injectable } from "@nestjs/common";
import {
  AUTOMATION_STATUSES,
  AUTOMATION_DEFINITION_KINDS,
  AUTOMATION_STEP_TYPES,
  AUTOMATION_TEMPLATE_TYPES,
  type SupportedLanguages,
  type AutomationDefinitionKind,
  type AutomationEventKind,
  type AutomationListQuery,
} from "@repo/shared";
import { and, count, desc, eq, inArray, getTableColumns, isNull, sql, type SQL } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { retainJsonbObjectKeys } from "src/common/helpers/sqlHelpers";
import { LocalizationService } from "src/localization/localization.service";
import { DB } from "src/storage/db/db.providers";
import { automations, automationSteps } from "src/storage/schema";

import type { AutomationMetadataUpdate } from "../automation.types";
import type { PgTransactionConfig, PgUpdateSetSource } from "drizzle-orm/pg-core";

@Injectable()
export class AutomationDefinitionRepository {
  constructor(
    @Inject(DB) private readonly database: DatabasePg,
    private readonly localizationService: LocalizationService,
  ) {}

  async removeUnusedEmailTagMappings(
    templateId: UUIDType,
    usedTags: string[],
    definitionKind: AutomationDefinitionKind,
    transaction: DatabasePg,
  ): Promise<void> {
    const mappings = sql`COALESCE(${automationSteps.configuration}->'mappings', '{}'::jsonb)`;
    const retainedMappings = retainJsonbObjectKeys(mappings, usedTags);

    const changedSteps = await transaction
      .update(automationSteps)
      .set({
        configuration: sql`jsonb_set(${automationSteps.configuration}, '{mappings}', ${retainedMappings})`,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(automationSteps.definitionKind, definitionKind),
          sql`${automationSteps.configuration}->>'name' = ${AUTOMATION_STEP_TYPES.SEND_EMAIL}`,
          sql`${automationSteps.configuration}->'template'->>'type' = ${AUTOMATION_TEMPLATE_TYPES.CUSTOM}`,
          sql`${automationSteps.configuration}->'template'->>'id' = ${templateId}`,
          sql`${mappings} IS DISTINCT FROM ${retainedMappings}`,
        ),
      )
      .returning({ automationId: automationSteps.automationId });

    const automationIds = [...new Set(changedSteps.map((step) => step.automationId))];

    if (!automationIds.length) {
      return;
    }

    await transaction
      .update(automations)
      .set({
        updatedAt: new Date().toISOString(),
        ...(definitionKind === AUTOMATION_DEFINITION_KINDS.APPLIED
          ? { executionVersion: sql`${automations.executionVersion} + 1` }
          : {}),
      })
      .where(inArray(automations.id, automationIds));
  }

  async findAutomationPage(
    { page = 1, perPage = 20, search, status, language }: AutomationListQuery,
    transaction: DatabasePg,
  ) {
    const conditions: SQL[] = [isNull(automations.deletedAt)];

    if (status) {
      conditions.push(eq(automations.status, status));
    }

    if (search) {
      const localizedName = this.localizationService.getLocalizedSqlField(
        automations.name,
        language,
        automations,
      );

      conditions.push(sql`${localizedName} ILIKE ${`%${search.replace(/[\\%_]/g, "\\$&")}%`}`);
    }

    const [{ totalItems }] = await transaction
      .select({ totalItems: count() })
      .from(automations)
      .where(and(...conditions));

    const rows = await transaction
      .select(this.getLocalizedAutomationColumns(language))
      .from(automations)
      .where(and(...conditions))
      .orderBy(desc(automations.updatedAt), desc(automations.id))
      .limit(perPage)
      .offset((page - 1) * perPage);

    return { rows, pagination: { totalItems, page, perPage } };
  }

  async findAutomationById(
    id: UUIDType,
    transaction: DatabasePg,
    lock: boolean,
    language?: SupportedLanguages,
  ) {
    const query = transaction
      .select(this.getLocalizedAutomationColumns(language))
      .from(automations)
      .where(and(eq(automations.id, id), isNull(automations.deletedAt)));

    const [row] = await (lock ? query.for("update") : query);

    return row;
  }

  async findAutomationLocalizedMetadata(id: UUIDType, transaction: DatabasePg) {
    const [row] = await transaction
      .select({
        name: automations.name,
        description: automations.description,
        baseLanguage: automations.baseLanguage,
        availableLocales: automations.availableLocales,
      })
      .from(automations)
      .where(and(eq(automations.id, id), isNull(automations.deletedAt)));

    return row;
  }

  findAutomationsByIds(ids: UUIDType[], transaction: DatabasePg) {
    return transaction
      .select(this.getLocalizedAutomationColumns())
      .from(automations)
      .where(and(inArray(automations.id, ids), isNull(automations.deletedAt)));
  }

  findEnabledAutomations(transaction: DatabasePg, language?: SupportedLanguages) {
    return transaction
      .select(this.getLocalizedAutomationColumns(language))
      .from(automations)
      .where(
        and(eq(automations.status, AUTOMATION_STATUSES.ENABLED), isNull(automations.deletedAt)),
      );
  }

  async findBuiltInAutomationByEventKind(builtInKey: AutomationEventKind, transaction: DatabasePg) {
    const [row] = await transaction
      .select({ id: automations.id, deletedAt: automations.deletedAt })
      .from(automations)
      .where(eq(automations.builtInKey, builtInKey));

    return row;
  }

  async insertAutomation(values: typeof automations.$inferInsert, transaction: DatabasePg) {
    const [row] = await transaction.insert(automations).values(values).returning();

    return row;
  }

  updateAutomation(
    id: UUIDType,
    values: PgUpdateSetSource<typeof automations>,
    transaction: DatabasePg,
  ) {
    return transaction
      .update(automations)
      .set(values)
      .where(and(eq(automations.id, id), isNull(automations.deletedAt)));
  }

  updateLocalizedAutomationMetadata(
    id: UUIDType,
    language: SupportedLanguages,
    values: AutomationMetadataUpdate,
    transaction: DatabasePg,
  ) {
    const { name, description, appliedName, appliedDescription, ...metadata } = values;

    const localizedValues = {
      name,
      description,
      appliedName: appliedName ?? undefined,
      appliedDescription: appliedDescription ?? undefined,
    };

    const localizedUpdates = this.localizationService.updateLocalizableFields(
      ["name", "description", "appliedName", "appliedDescription"] as const,
      automations,
      localizedValues,
      language,
      true,
    );

    const queryValues: PgUpdateSetSource<typeof automations> = {
      ...metadata,
      ...(localizedUpdates as Pick<
        PgUpdateSetSource<typeof automations>,
        "name" | "description" | "appliedName" | "appliedDescription"
      >),
    };

    if (appliedName === null) {
      queryValues.appliedName = null;
    }

    if (appliedDescription === null) {
      queryValues.appliedDescription = null;
    }

    return this.updateAutomation(id, queryValues, transaction);
  }

  copyDraftLocalizedMetadataToApplied(id: UUIDType, transaction: DatabasePg) {
    return this.updateAutomation(
      id,
      {
        appliedName: sql`${automations.name}`,
        appliedDescription: sql`${automations.description}`,
      },
      transaction,
    );
  }

  findAutomationSteps(automationIds: UUIDType[], transaction: DatabasePg) {
    return transaction
      .select()
      .from(automationSteps)
      .where(inArray(automationSteps.automationId, automationIds));
  }

  deleteAutomationSteps(
    automationId: UUIDType,
    definitionKind: AutomationDefinitionKind,
    transaction: DatabasePg,
  ) {
    return transaction
      .delete(automationSteps)
      .where(
        and(
          eq(automationSteps.automationId, automationId),
          eq(automationSteps.definitionKind, definitionKind),
        ),
      );
  }

  insertAutomationSteps(
    values: Array<typeof automationSteps.$inferInsert>,
    transaction: DatabasePg,
  ) {
    return transaction.insert(automationSteps).values(values);
  }

  private getLocalizedAutomationColumns(language?: SupportedLanguages) {
    return {
      ...getTableColumns(automations),
      hasLocalizedMetadataChanges: sql<boolean>`
        ${automations.name} IS DISTINCT FROM ${automations.appliedName}
        OR ${automations.description} IS DISTINCT FROM ${automations.appliedDescription}
      `,
      name: this.localizationService.getLocalizedSqlField(automations.name, language, automations),
      description: this.localizationService.getLocalizedSqlField(
        automations.description,
        language,
        automations,
      ),
      localizedAppliedName: sql<string | null>`CASE WHEN ${
        automations.appliedName
      } IS NULL THEN NULL ELSE ${this.localizationService.getLocalizedSqlField(
        automations.appliedName,
        language,
        automations,
      )} END`,
      localizedAppliedDescription: sql<string | null>`CASE WHEN ${
        automations.appliedDescription
      } IS NULL THEN NULL ELSE ${this.localizationService.getLocalizedSqlField(
        automations.appliedDescription,
        language,
        automations,
      )} END`,
    };
  }

  withAutomationTransaction<T>(
    callback: (transaction: DatabasePg) => Promise<T>,
    config?: PgTransactionConfig,
  ): Promise<T> {
    return this.database.transaction(callback, config);
  }
}
