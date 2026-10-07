import { Inject, Injectable } from "@nestjs/common";
import { AUTOMATION_EMAIL_DELIVERY_STATUSES } from "@repo/shared";
import { and, eq, isNotNull, lt, sql } from "drizzle-orm";

import { DatabasePg, type UUIDType } from "src/common";
import { OUTBOX_STATUSES } from "src/outbox/outbox.types";
import { DB } from "src/storage/db/db.providers";
import {
  automationEmailDeliveries,
  createTokens,
  credentials,
  notificationAccountActionIntents,
  outboxEvents,
} from "src/storage/schema";

import type {
  NotificationAccountActionIntent,
  AccountActionVerificationTable,
  AccountActionVerificationInsert,
  PreparedNotificationAccountActionIntent,
} from "../automation-execution.types";

@Injectable()
export class NotificationAccountActionRepository {
  constructor(@Inject(DB) private readonly database: DatabasePg) {}

  insertNotificationAccountActionIntent(
    intent: NotificationAccountActionIntent,
    transaction: DatabasePg = this.database,
  ) {
    return transaction
      .insert(notificationAccountActionIntents)
      .values(intent)
      .returning({ id: notificationAccountActionIntents.id });
  }

  listNotificationAccountActionIntentsForUpdate(reference: string, transaction: DatabasePg) {
    return transaction
      .select()
      .from(notificationAccountActionIntents)
      .where(eq(notificationAccountActionIntents.id, reference))
      .for("update");
  }

  listAccountActionVerificationsById(
    table: AccountActionVerificationTable,
    id: UUIDType,
    transaction: DatabasePg,
  ) {
    return transaction
      .select({ userId: table.userId, tokenHash: table.tokenHash, expiryDate: table.expiryDate })
      .from(table)
      .where(eq(table.id, id));
  }

  listUserPasswordCredentials(userId: UUIDType, transaction: DatabasePg) {
    return transaction
      .select({ userId: credentials.userId })
      .from(credentials)
      .where(eq(credentials.userId, userId));
  }

  deleteUserCreatePasswordTokens(userId: UUIDType, transaction: DatabasePg) {
    return transaction.delete(createTokens).where(eq(createTokens.userId, userId));
  }

  insertAccountActionVerification(
    table: AccountActionVerificationTable,
    values: AccountActionVerificationInsert,
    transaction: DatabasePg,
  ) {
    return transaction.insert(table).values(values).returning({ id: table.id });
  }

  updatePreparedNotificationAccountActionIntent(
    reference: string,
    values: PreparedNotificationAccountActionIntent,
    transaction: DatabasePg,
  ) {
    return transaction
      .update(notificationAccountActionIntents)
      .set(values)
      .where(eq(notificationAccountActionIntents.id, reference));
  }

  scrubUnusedAccountActionTokenMaterial() {
    const noActiveDelivery = this.buildNoActiveAccountActionDeliveryCondition();
    const noPendingSource = this.buildNoPendingAccountActionSourceCondition();

    return this.database
      .update(notificationAccountActionIntents)
      .set({ encryptedToken: null })
      .where(
        and(
          isNotNull(notificationAccountActionIntents.encryptedToken),
          sql`(${notificationAccountActionIntents.tokenExpiresAt} < CURRENT_TIMESTAMP OR (${noActiveDelivery} AND ${noPendingSource}))`,
        ),
      );
  }

  deleteUnusedNotificationAccountActionIntents(cutoff: string) {
    return this.database
      .delete(notificationAccountActionIntents)
      .where(
        and(
          lt(notificationAccountActionIntents.createdAt, cutoff),
          this.buildNoActiveAccountActionDeliveryCondition(),
          this.buildNoPendingAccountActionSourceCondition(),
        ),
      );
  }

  private buildNoActiveAccountActionDeliveryCondition() {
    return sql`NOT EXISTS (
      SELECT 1 FROM ${automationEmailDeliveries}
      WHERE ${automationEmailDeliveries.accountActionIntentId} = ${notificationAccountActionIntents.id}
        AND ${automationEmailDeliveries.status} IN (${AUTOMATION_EMAIL_DELIVERY_STATUSES.PENDING}, ${AUTOMATION_EMAIL_DELIVERY_STATUSES.PROCESSING}, ${AUTOMATION_EMAIL_DELIVERY_STATUSES.RETRYING})
    )`;
  }

  private buildNoPendingAccountActionSourceCondition() {
    return sql`NOT EXISTS (
      SELECT 1 FROM ${outboxEvents}
      WHERE ${outboxEvents.eventType} = 'NotificationEvent'
        AND ${outboxEvents.status} IN (${OUTBOX_STATUSES.PENDING}, ${OUTBOX_STATUSES.PROCESSING}, ${OUTBOX_STATUSES.FAILED})
        AND jsonb_path_exists(
          ${outboxEvents.payload},
          '$.recipients[*] ? (@.accountActionIntentId == $reference)',
          jsonb_build_object('reference', ${notificationAccountActionIntents.id}::text)
        )
    )`;
  }
}
