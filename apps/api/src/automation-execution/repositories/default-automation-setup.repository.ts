import { Injectable } from "@nestjs/common";
import { EMAIL_TEMPLATE_STATUSES, type PublishedEmailTemplate } from "@repo/email-templates";
import {
  AUTOMATION_NODE_KINDS,
  AUTOMATION_STEP_TYPES,
  AUTOMATION_TEMPLATE_TYPES,
} from "@repo/shared";
import { eq, ne, inArray, isNull, isNotNull, and, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { OUTBOX_STATUSES } from "src/outbox/outbox.types";
import {
  automations,
  automationSteps,
  emailTemplates,
  outboxEvents,
  settings,
} from "src/storage/schema";

import type {
  BuiltInTemplateEmailStep,
  DefaultAutomationTranslationUpdate,
} from "../automation-execution.types";
import type { AutomationPlaceholderMappings } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";

@Injectable()
export class DefaultAutomationSetupRepository {
  listTenantDefaultAutomationTranslations(transaction: DatabasePg) {
    return transaction
      .select({
        id: automations.id,
        builtInKey: automations.builtInKey,
        name: automations.name,
        description: automations.description,
        appliedName: automations.appliedName,
        appliedDescription: automations.appliedDescription,
        availableLocales: automations.availableLocales,
      })
      .from(automations)
      .where(and(isNotNull(automations.builtInKey), isNull(automations.deletedAt)));
  }

  updateDefaultAutomationTranslations(
    id: UUIDType,
    values: DefaultAutomationTranslationUpdate,
    transaction: DatabasePg,
  ) {
    return transaction.update(automations).set(values).where(eq(automations.id, id));
  }

  listBuiltInTemplateEmailSteps(transaction: DatabasePg): Promise<BuiltInTemplateEmailStep[]> {
    const triggerSteps = alias(automationSteps, "trigger_steps");

    return transaction
      .select({
        id: automationSteps.id,
        automationId: automationSteps.automationId,
        definitionKind: automationSteps.definitionKind,
        templateKey: sql<string>`${automationSteps.configuration}->'template'->>'key'`,
        mappings: sql<AutomationPlaceholderMappings>`COALESCE(${automationSteps.configuration}->'mappings', '{}'::jsonb)`,
        triggerEventKind: sql<string | null>`${triggerSteps.configuration}->>'name'`,
      })
      .from(automationSteps)
      .leftJoin(
        triggerSteps,
        and(
          eq(triggerSteps.automationId, automationSteps.automationId),
          eq(triggerSteps.definitionKind, automationSteps.definitionKind),
          eq(triggerSteps.nodeKind, AUTOMATION_NODE_KINDS.TRIGGER),
        ),
      )
      .where(
        and(
          sql`${automationSteps.configuration}->>'name' = ${AUTOMATION_STEP_TYPES.SEND_EMAIL}`,
          sql`${automationSteps.configuration}->'template'->>'type' = ${AUTOMATION_TEMPLATE_TYPES.BUILTIN}`,
        ),
      );
  }

  async addEmailStepMappings(
    step: Pick<BuiltInTemplateEmailStep, "id" | "automationId" | "definitionKind">,
    mappings: AutomationPlaceholderMappings,
    transaction: DatabasePg,
  ): Promise<void> {
    const currentMappings = sql`COALESCE(${automationSteps.configuration}->'mappings', '{}'::jsonb)`;

    await transaction
      .update(automationSteps)
      .set({
        configuration: sql`jsonb_set(
          ${automationSteps.configuration},
          '{mappings}',
          ${JSON.stringify(mappings)}::text::jsonb || ${currentMappings}
        )`,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(automationSteps.id, step.id),
          eq(automationSteps.automationId, step.automationId),
          eq(automationSteps.definitionKind, step.definitionKind),
        ),
      );
  }

  listTenantDefaultAutomationScenarios(transaction: DatabasePg) {
    return transaction
      .select({ scenario: automations.builtInKey })
      .from(automations)
      .where(isNotNull(automations.builtInKey));
  }

  async findOrganizationNotificationSettings(transaction: DatabasePg) {
    const [organization] = await transaction
      .select({ values: settings.settings })
      .from(settings)
      .where(isNull(settings.userId));

    return organization;
  }

  listLegacyPublishedEmailTemplates(transaction: DatabasePg) {
    return transaction
      .select()
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.status, EMAIL_TEMPLATE_STATUSES.PUBLISHED),
          isNotNull(emailTemplates.event),
          isNull(emailTemplates.publication),
          eq(emailTemplates.publicationVersion, 0),
          isNull(emailTemplates.deletedAt),
        ),
      )
      .for("update");
  }

  backfillLegacyEmailTemplatePublication(
    id: UUIDType,
    publication: PublishedEmailTemplate,
    transaction: DatabasePg,
  ) {
    return transaction
      .update(emailTemplates)
      .set({
        placeholders: publication.placeholders,
        publication,
        publicationVersion: 1,
        triggerEventKind: sql`${emailTemplates.event}`,
      })
      .where(eq(emailTemplates.id, id));
  }

  async listPublishedCustomEmailTemplates(transaction: DatabasePg) {
    return transaction
      .select({
        id: emailTemplates.id,
        event: emailTemplates.event,
        publication: emailTemplates.publication,
      })
      .from(emailTemplates)
      .where(
        and(
          eq(emailTemplates.status, EMAIL_TEMPLATE_STATUSES.PUBLISHED),
          isNull(emailTemplates.deletedAt),
        ),
      );
  }

  async cancelLegacyNotificationEmailCommands(transaction: DatabasePg): Promise<void> {
    await transaction
      .update(outboxEvents)
      .set({
        payload: {},
        status: OUTBOX_STATUSES.PUBLISHED,
        publishedAt: sql`CURRENT_TIMESTAMP`,
        updatedAt: sql`CURRENT_TIMESTAMP`,
        lastError: "Legacy email delivery cancelled during automation migration",
      })
      .where(
        and(
          inArray(outboxEvents.eventType, [
            "UserInviteEvent",
            "UsersImportInviteEmailsEvent",
            "UserPasswordReminderEvent",
            "UserWelcomeEvent",
          ]),
          or(ne(outboxEvents.status, OUTBOX_STATUSES.PUBLISHED), ne(outboxEvents.payload, {})),
        ),
      );

    await transaction
      .update(outboxEvents)
      .set({
        payload: sql`${outboxEvents.payload} #- '{userPasswordEmails,emails}'`,
        updatedAt: sql`${outboxEvents.updatedAt}`,
      })
      .where(
        and(
          eq(outboxEvents.eventType, "UserPasswordEmailsEvent"),
          isNotNull(sql`${outboxEvents.payload} #> '{userPasswordEmails,emails}'`),
        ),
      );
  }
}
