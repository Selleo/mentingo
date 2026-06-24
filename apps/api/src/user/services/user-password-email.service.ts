import { Inject, Injectable } from "@nestjs/common";
import { CreatePasswordReminderEmail, PasswordRecoveryEmail } from "@repo/email-templates";
import { nanoid } from "nanoid";

import { hashToken } from "src/auth/utils/hash-auth-token";
import { DatabasePg } from "src/common";
import { EMAIL_BATCH_SIZE } from "src/common/emails/email.constants";
import { EmailService } from "src/common/emails/emails.service";
import { getEmailSubject } from "src/common/emails/translations";
import { buildCreateNewPasswordLink } from "src/common/helpers/buildCreateNewPasswordLink";
import { processInBatches } from "src/common/utils/processInBatches";
import {
  USER_PASSWORD_EMAIL_TYPES,
  UserPasswordEmailsEvent,
  type UserPasswordEmailType,
} from "src/events/user/user-password-emails.event";
import { OutboxPublisher } from "src/outbox/outbox.publisher";
import { DB } from "src/storage/db/db.providers";
import { UserPasswordEmailRepository } from "src/user/repositories/user-password-email.repository";

import type { UUIDType } from "src/common";
import type { CurrentUserType } from "src/common/types/current-user.type";
import type { BulkUserPasswordEmailResponse } from "src/user/schemas/userPasswordEmail.schema";
import type {
  PreparedUserPasswordEmail,
  UserCreatePasswordTokenInsert,
  UserPasswordEmailRecipient,
  UserPasswordEmailTokenInsert,
} from "src/user/user.types";

@Injectable()
export class UserPasswordEmailService {
  constructor(
    @Inject(DB) private readonly db: DatabasePg,
    private readonly userPasswordEmailRepository: UserPasswordEmailRepository,
    private readonly emailService: EmailService,
    private readonly outboxPublisher: OutboxPublisher,
  ) {}

  async sendBulkPasswordResetEmails(
    userIds: UUIDType[],
    currentUser: CurrentUserType,
  ): Promise<BulkUserPasswordEmailResponse> {
    const uniqueUserIds = this.getUniqueUserIds(userIds);

    const tenantOrigin = await this.userPasswordEmailRepository.findTenantOrigin(
      currentUser.tenantId,
    );

    const recipients = await this.userPasswordEmailRepository.findRecipientsByIds(uniqueUserIds, {
      hasCredentials: true,
    });

    const preparedResetEmails = this.preparePasswordResetEmails(recipients, tenantOrigin);

    const result = {
      sentCount: preparedResetEmails.emails.length,
      skippedCount: uniqueUserIds.length - preparedResetEmails.emails.length,
    };

    if (!preparedResetEmails.emails.length) return result;

    await this.db.transaction(async (trx) => {
      await this.userPasswordEmailRepository.insertResetTokens(preparedResetEmails.tokenRows, trx);

      await this.publishPasswordEmailsEvent(
        USER_PASSWORD_EMAIL_TYPES.RESET,
        currentUser,
        preparedResetEmails.emails,
        result,
        trx,
      );
    });

    return result;
  }

  async sendBulkPasswordCreationEmails(
    userIds: UUIDType[],
    currentUser: CurrentUserType,
  ): Promise<BulkUserPasswordEmailResponse> {
    const uniqueUserIds = this.getUniqueUserIds(userIds);

    const recipients = await this.userPasswordEmailRepository.findRecipientsByIds(uniqueUserIds, {
      hasCredentials: false,
    });

    const tenantOrigin = await this.userPasswordEmailRepository.findTenantOrigin(
      currentUser.tenantId,
    );

    const preparedCreationEmails = this.preparePasswordCreationEmails(recipients, tenantOrigin);

    const result = {
      sentCount: preparedCreationEmails.emails.length,
      skippedCount: uniqueUserIds.length - preparedCreationEmails.emails.length,
    };

    if (!preparedCreationEmails.emails.length) return result;

    await this.db.transaction(async (trx) => {
      await this.userPasswordEmailRepository.replaceCreateTokens(
        preparedCreationEmails.tokenRows,
        trx,
      );

      await this.publishPasswordEmailsEvent(
        USER_PASSWORD_EMAIL_TYPES.CREATION,
        currentUser,
        preparedCreationEmails.emails,
        result,
        trx,
      );
    });

    return result;
  }

  async sendForgotPasswordEmail(email: string, dbInstance?: DatabasePg): Promise<void> {
    const recipient = await this.userPasswordEmailRepository.findRecipientByEmail(
      email,
      dbInstance,
    );

    if (!recipient) return;

    const tenantOrigin = await this.userPasswordEmailRepository.findTenantOrigin(
      recipient.tenantId,
    );

    const preparedResetEmails = this.preparePasswordResetEmails([recipient], tenantOrigin);

    await this.userPasswordEmailRepository.insertResetTokens(
      preparedResetEmails.tokenRows,
      dbInstance,
    );

    await this.sendPreparedEmails(preparedResetEmails.emails);
  }

  private getUniqueUserIds(userIds: UUIDType[]) {
    return [...new Set(userIds)];
  }

  private preparePasswordResetEmails(
    recipients: UserPasswordEmailRecipient[],
    tenantOrigin: string,
  ) {
    const expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + 1);

    const tokenRows: UserPasswordEmailTokenInsert[] = [];
    const emails: PreparedUserPasswordEmail[] = [];

    for (const recipient of recipients) {
      const resetToken = nanoid(64);

      tokenRows.push({
        userId: recipient.id,
        tokenHash: hashToken(resetToken),
        expiryDate,
      });

      const emailTemplate = new PasswordRecoveryEmail({
        name: recipient.firstName,
        resetLink: buildCreateNewPasswordLink(tenantOrigin, { resetToken }),
        ...recipient.defaultEmailSettings,
      });

      emails.push({
        userId: recipient.id,
        to: recipient.email,
        tenantId: recipient.tenantId,
        subject: getEmailSubject("passwordRecoveryEmail", recipient.defaultEmailSettings.language),
        text: emailTemplate.text,
        html: emailTemplate.html,
      });
    }

    return { tokenRows, emails };
  }

  private preparePasswordCreationEmails(
    recipients: UserPasswordEmailRecipient[],
    tenantOrigin: string,
  ) {
    const expiryDate = new Date();
    expiryDate.setFullYear(expiryDate.getFullYear() + 1);

    const tokenRows: UserCreatePasswordTokenInsert[] = [];
    const emails: PreparedUserPasswordEmail[] = [];

    for (const recipient of recipients) {
      const createToken = nanoid(64);

      tokenRows.push({
        userId: recipient.id,
        tokenHash: hashToken(createToken),
        expiryDate,
        reminderCount: 0,
      });

      const emailTemplate = new CreatePasswordReminderEmail({
        createPasswordLink: buildCreateNewPasswordLink(tenantOrigin, { createToken }),
        ...recipient.defaultEmailSettings,
      });

      emails.push({
        userId: recipient.id,
        to: recipient.email,
        tenantId: recipient.tenantId,
        subject: getEmailSubject("passwordReminderEmail", recipient.defaultEmailSettings.language),
        text: emailTemplate.text,
        html: emailTemplate.html,
      });
    }

    return { tokenRows, emails };
  }

  private async publishPasswordEmailsEvent(
    type: UserPasswordEmailType,
    actor: CurrentUserType,
    emails: PreparedUserPasswordEmail[],
    result: BulkUserPasswordEmailResponse,
    dbInstance: DatabasePg,
  ) {
    await this.outboxPublisher.publish(
      new UserPasswordEmailsEvent({
        actor,
        tenantId: actor.tenantId,
        type,
        emails,
        recipients: emails.map(({ userId, to }) => ({ userId, email: to })),
        sentCount: result.sentCount,
        skippedCount: result.skippedCount,
      }),
      dbInstance,
    );
  }

  private async sendPreparedEmails(emails: PreparedUserPasswordEmail[]) {
    await processInBatches(
      emails,
      ({ to, subject, text, html, tenantId }) =>
        this.emailService.sendEmailWithLogo(
          {
            to,
            subject,
            text,
            html,
          },
          { tenantId },
        ),
      { batchSize: EMAIL_BATCH_SIZE },
    );
  }
}
