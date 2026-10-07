import { Injectable } from "@nestjs/common";
import { EMAIL_TEMPLATE_STATUSES } from "@repo/email-templates";
import { eq, ne, inArray, isNull, isNotNull, and, or, sql } from "drizzle-orm";

import { OUTBOX_STATUSES } from "src/outbox/outbox.types";
import { automations, emailTemplates, outboxEvents, settings } from "src/storage/schema";

import type { DefaultAutomationTranslationUpdate } from "../automation-execution.types";
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
