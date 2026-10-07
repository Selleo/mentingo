import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { AUTOMATION_EVENT_KINDS } from "@repo/shared";

import { NotificationEvent } from "src/automation-execution/events/notification-event";
import { NotificationAccountActionService } from "src/automation-execution/services/notification-account-action.service";
import { DatabasePg } from "src/common";
import {
  USER_PASSWORD_EMAIL_TYPES,
  UserPasswordEmailsEvent,
  type UserPasswordEmailType,
} from "src/events/user/user-password-emails.event";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { DB } from "src/storage/db/db.providers";
import { UserPasswordEmailRepository } from "src/user/repositories/user-password-email.repository";

import type { NotificationRecipient } from "src/automation-execution/automation-execution.types";
import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type {
  BulkUserPasswordEmailResponse,
  BulkUserPasswordEmailsResponse,
} from "src/user/schemas/userPasswordEmail.schema";
import type { UserPasswordEmailRecipient } from "src/user/user.types";

@Injectable()
export class UserPasswordEmailService {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly userPasswordEmailRepository: UserPasswordEmailRepository,
    private readonly outboxPublisher: OutboxPublisher,
    private readonly notificationAccountActionService: NotificationAccountActionService,
  ) {}

  async sendBulkPasswordResetEmails(
    userIds: UUIDType[],
    actor: CurrentUserType,
  ): Promise<BulkUserPasswordEmailResponse> {
    return this.sendBulkByType(userIds, actor, USER_PASSWORD_EMAIL_TYPES.RESET);
  }

  async sendBulkPasswordCreationEmails(
    userIds: UUIDType[],
    actor: CurrentUserType,
  ): Promise<BulkUserPasswordEmailResponse> {
    return this.sendBulkByType(userIds, actor, USER_PASSWORD_EMAIL_TYPES.CREATION);
  }

  private async sendBulkByType(
    userIds: UUIDType[],
    actor: CurrentUserType,
    type: UserPasswordEmailType,
  ) {
    const uniqueUserIds = [...new Set(userIds)];
    const recipients = await this.userPasswordEmailRepository.findRecipientsByIds(uniqueUserIds, {
      hasCredentials: type === "reset",
    });
    const result = {
      sentCount: recipients.length,
      skippedCount: uniqueUserIds.length - recipients.length,
    };
    if (recipients.length === 0) {
      return result;
    }

    const origin = await this.userPasswordEmailRepository.findTenantOrigin(actor.tenantId);
    await this.db.transaction(async (tx) => {
      await this.publishRecipients(recipients, type, origin, tx);
      await this.publishActivity(type, actor, recipients, result, tx);
    });
    return result;
  }

  async sendBulkPasswordEmails(
    userIds: UUIDType[],
    actor: CurrentUserType,
  ): Promise<BulkUserPasswordEmailsResponse> {
    const uniqueUserIds = [...new Set(userIds)];
    const recipients = await this.userPasswordEmailRepository.findRecipientsByIds(uniqueUserIds);
    const resetRecipients = recipients.filter((recipient) => recipient.hasCredentials);
    const creationRecipients = recipients.filter((recipient) => !recipient.hasCredentials);
    const result = {
      sentCount: recipients.length,
      skippedCount: uniqueUserIds.length - recipients.length,
      passwordResetSentCount: resetRecipients.length,
      passwordCreationSentCount: creationRecipients.length,
    };
    if (recipients.length === 0) {
      return result;
    }

    const origin = await this.userPasswordEmailRepository.findTenantOrigin(actor.tenantId);
    await this.db.transaction(async (tx) => {
      await this.publishRecipientBatch(
        resetRecipients,
        USER_PASSWORD_EMAIL_TYPES.RESET,
        actor,
        origin,
        tx,
      );
      await this.publishRecipientBatch(
        creationRecipients,
        USER_PASSWORD_EMAIL_TYPES.CREATION,
        actor,
        origin,
        tx,
      );
    });
    return result;
  }

  private async publishRecipientBatch(
    recipients: UserPasswordEmailRecipient[],
    type: UserPasswordEmailType,
    actor: CurrentUserType,
    origin: string,
    transaction: DatabasePg,
  ): Promise<void> {
    if (recipients.length === 0) return;

    await this.publishRecipients(recipients, type, origin, transaction);
    await this.publishActivity(
      type,
      actor,
      recipients,
      { sentCount: recipients.length, skippedCount: 0 },
      transaction,
    );
  }

  async sendForgotPasswordEmail(email: string, dbInstance?: DatabasePg): Promise<void> {
    const recipient = await this.userPasswordEmailRepository.findRecipientByEmail(
      email,
      dbInstance,
    );
    if (!recipient) {
      return;
    }

    const origin = await this.userPasswordEmailRepository.findTenantOrigin(recipient.tenantId);
    if (dbInstance) {
      await this.publishRecipients([recipient], "reset", origin, dbInstance);
      return;
    }

    await this.db.transaction((transaction) =>
      this.publishRecipients([recipient], "reset", origin, transaction),
    );
  }

  private async publishRecipients(
    recipients: UserPasswordEmailRecipient[],
    type: UserPasswordEmailType,
    origin: string,
    transaction: DatabasePg,
  ) {
    const notificationRecipients: NotificationRecipient[] = [];
    for (const recipient of recipients) {
      const accountActionIntentId =
        await this.notificationAccountActionService.createNotificationAccountActionIntent(
          {
            userId: recipient.id,
            kind: type === "reset" ? "reset_password" : "create_password",
            applicationOrigin: origin,
            tokenTtlMs: type === "reset" ? 3600000 : 365 * 86400000,
            usesCalendarYearExpiry: type === "creation",
            revokePreviousPasswordSetupTokens: type === "creation",
            reminderCount: 0,
          },
          transaction,
        );
      notificationRecipients.push({
        itemId: recipient.id,
        email: recipient.email,
        name: recipient.firstName,
        language: recipient.defaultEmailSettings.language,
        eventFields: {
          name: recipient.firstName,
          userFirstName: recipient.firstName,
          userLastName: recipient.lastName ?? "",
          userEmail: recipient.email,
        },
        accountActionIntentId,
      });
    }
    await this.outboxPublisher.publish(
      new NotificationEvent(
        randomUUID(),
        type === USER_PASSWORD_EMAIL_TYPES.RESET
          ? AUTOMATION_EVENT_KINDS.PASSWORD_RECOVERY
          : AUTOMATION_EVENT_KINDS.PASSWORD_REMINDER,
        notificationRecipients,
      ),
      transaction,
    );
  }

  private async publishActivity(
    type: UserPasswordEmailType,
    actor: CurrentUserType,
    recipients: UserPasswordEmailRecipient[],
    result: BulkUserPasswordEmailResponse,
    transaction: DatabasePg,
  ) {
    await this.outboxPublisher.publish(
      new UserPasswordEmailsEvent({
        actor,
        tenantId: actor.tenantId,
        type,
        recipients: recipients.map((item) => ({ userId: item.id, email: item.email })),
        sentCount: result.sentCount,
        skippedCount: result.skippedCount,
      }),
      transaction,
    );
  }
}
