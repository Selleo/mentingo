import { randomBytes } from "node:crypto";

import { Injectable } from "@nestjs/common";
import { nanoid } from "nanoid";

import { hashToken } from "src/auth/utils/hash-auth-token";
import { buildCreateNewPasswordLink } from "src/common/helpers/buildCreateNewPasswordLink";
import { decryptWithAesGcm, encryptWithAesGcm } from "src/common/utils/aesGcm";
import { TenantDbRunnerService } from "src/storage/db/tenant-db-runner.service";
import { createTokens, magicLinkTokens, resetTokens } from "src/storage/schema";

import {
  NOTIFICATION_ACCOUNT_ACTION_KINDS,
  NOTIFICATION_ACCOUNT_ACTION_INTENT_RETENTION_DAYS,
} from "../automation-execution.constants";
import { NotificationAccountActionRepository } from "../repositories/notification-account-action.repository";

import type {
  NotificationAccountActionPreparation,
  EncryptedAccountActionToken,
  NotificationAccountActionIntent,
  NotificationAccountActionIntentRecord,
} from "../automation-execution.types";
import type { AutomationPlaceholderValue } from "@repo/shared";
import type { DatabasePg, UUIDType } from "src/common";

@Injectable()
export class NotificationAccountActionService implements NotificationAccountActionPreparation {
  constructor(
    private readonly notificationAccountActionRepository: NotificationAccountActionRepository,
    private readonly tenantDbRunnerService: TenantDbRunnerService,
  ) {}

  async createNotificationAccountActionIntent(
    intent: NotificationAccountActionIntent,
    transaction?: DatabasePg,
  ): Promise<UUIDType> {
    if (!Number.isSafeInteger(intent.tokenTtlMs) || intent.tokenTtlMs <= 0) {
      throw new Error("Invalid account-action lifetime");
    }

    const [record] =
      await this.notificationAccountActionRepository.insertNotificationAccountActionIntent(
        intent,
        transaction,
      );

    return record.id as UUIDType;
  }

  async prepareNotificationAccountActionFields(
    reference: string,
  ): Promise<Record<string, AutomationPlaceholderValue> | null> {
    return this.tenantDbRunnerService.transactionWithHandle(async (transaction) => {
      const [intent] =
        await this.notificationAccountActionRepository.listNotificationAccountActionIntentsForUpdate(
          reference,
          transaction,
        );

      if (!intent) {
        return null;
      }

      if (intent.kind === NOTIFICATION_ACCOUNT_ACTION_KINDS.CREATE_PASSWORD) {
        const [existingPassword] =
          await this.notificationAccountActionRepository.listUserPasswordCredentials(
            intent.userId,
            transaction,
          );

        if (existingPassword) {
          return null;
        }
      }

      if (intent.tokenCreatedAt) {
        return this.reusePreparedAccountActionToken(intent, transaction);
      }

      return this.prepareNewAccountActionToken(intent, transaction);
    });
  }

  private async reusePreparedAccountActionToken(
    intent: NotificationAccountActionIntentRecord,
    transaction: DatabasePg,
  ) {
    if (!intent.encryptedToken || !intent.tokenExpiresAt || !intent.authTokenId) {
      return null;
    }

    if (new Date(intent.tokenExpiresAt).getTime() <= Date.now()) {
      return null;
    }

    const [verification] =
      await this.notificationAccountActionRepository.listAccountActionVerificationsById(
        this.getAccountActionVerificationTable(intent.kind),
        intent.authTokenId,
        transaction,
      );

    if (
      !verification ||
      verification.userId !== intent.userId ||
      verification.expiryDate.getTime() <= Date.now()
    ) {
      return null;
    }

    const token = this.decryptAccountActionToken(intent.encryptedToken);

    if (verification.tokenHash !== hashToken(token)) {
      return null;
    }

    return this.buildNotificationAccountActionFields(intent.kind, intent.applicationOrigin, token);
  }

  private async prepareNewAccountActionToken(
    intent: NotificationAccountActionIntentRecord,
    transaction: DatabasePg,
  ) {
    const createsPassword = intent.kind === NOTIFICATION_ACCOUNT_ACTION_KINDS.CREATE_PASSWORD;

    if (createsPassword && intent.revokePreviousPasswordSetupTokens) {
      await this.notificationAccountActionRepository.deleteUserCreatePasswordTokens(
        intent.userId,
        transaction,
      );
    }

    const token = nanoid(64);
    const expiresAt = this.calculateAccountActionTokenExpiry(intent);

    const [verification] =
      await this.notificationAccountActionRepository.insertAccountActionVerification(
        this.getAccountActionVerificationTable(intent.kind),
        {
          userId: intent.userId,
          tokenHash: hashToken(token),
          expiryDate: expiresAt,
          ...(createsPassword ? { reminderCount: intent.reminderCount } : {}),
        },
        transaction,
      );

    await this.notificationAccountActionRepository.updatePreparedNotificationAccountActionIntent(
      intent.id,
      {
        authTokenId: verification.id,
        encryptedToken: this.encryptAccountActionToken(token),
        tokenCreatedAt: new Date().toISOString(),
        tokenExpiresAt: expiresAt.toISOString(),
      },
      transaction,
    );

    return this.buildNotificationAccountActionFields(intent.kind, intent.applicationOrigin, token);
  }

  private calculateAccountActionTokenExpiry(intent: NotificationAccountActionIntentRecord): Date {
    const expiresAt = new Date(Date.now() + intent.tokenTtlMs);

    if (intent.usesCalendarYearExpiry) {
      expiresAt.setTime(Date.now());
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }

    return expiresAt;
  }

  async purgeUnusedNotificationAccountActionIntents(): Promise<void> {
    const cutoff = new Date(
      Date.now() - NOTIFICATION_ACCOUNT_ACTION_INTENT_RETENTION_DAYS * 86400000,
    ).toISOString();

    await this.notificationAccountActionRepository.scrubUnusedAccountActionTokenMaterial();

    await this.notificationAccountActionRepository.deleteUnusedNotificationAccountActionIntents(
      cutoff,
    );
  }

  private buildNotificationAccountActionFields(
    kind: NotificationAccountActionIntent["kind"],
    origin: string,
    token: string,
  ): Record<string, AutomationPlaceholderValue> {
    if (kind === NOTIFICATION_ACCOUNT_ACTION_KINDS.SIGN_IN) {
      const url = new URL("/auth/login", origin);

      url.searchParams.set("token", token);

      return { magic_link: url.toString() };
    }

    if (kind === NOTIFICATION_ACCOUNT_ACTION_KINDS.RESET_PASSWORD) {
      return { reset_link: buildCreateNewPasswordLink(origin, { resetToken: token }) };
    }

    return { create_password_link: buildCreateNewPasswordLink(origin, { createToken: token }) };
  }

  private getAccountActionVerificationTable(kind: NotificationAccountActionIntent["kind"]) {
    switch (kind) {
      case NOTIFICATION_ACCOUNT_ACTION_KINDS.CREATE_PASSWORD:
        return createTokens;
      case NOTIFICATION_ACCOUNT_ACTION_KINDS.RESET_PASSWORD:
        return resetTokens;
      case NOTIFICATION_ACCOUNT_ACTION_KINDS.SIGN_IN:
        return magicLinkTokens;
    }
  }

  private getAccountActionEncryptionKey(): Buffer {
    const key = Buffer.from(process.env.MASTER_KEY ?? "", "base64");

    if (key.length !== 32) {
      throw new Error("MASTER_KEY must be a base64-encoded 32-byte key");
    }

    return key;
  }

  private encryptAccountActionToken(token: string): EncryptedAccountActionToken {
    const dataKey = randomBytes(32);
    const material = encryptWithAesGcm(dataKey, token);
    const wrapped = encryptWithAesGcm(this.getAccountActionEncryptionKey(), dataKey);

    return {
      ciphertext: material.ciphertext.toString("base64"),
      iv: material.iv.toString("base64"),
      tag: material.authTag.toString("base64"),
      encryptedKey: wrapped.ciphertext.toString("base64"),
      keyIv: wrapped.iv.toString("base64"),
      keyTag: wrapped.authTag.toString("base64"),
    };
  }

  private decryptAccountActionToken(material: EncryptedAccountActionToken): string {
    const dataKey = decryptWithAesGcm(this.getAccountActionEncryptionKey(), {
      ciphertext: Buffer.from(material.encryptedKey, "base64"),
      iv: Buffer.from(material.keyIv, "base64"),
      authTag: Buffer.from(material.keyTag, "base64"),
    });

    return decryptWithAesGcm(dataKey, {
      ciphertext: Buffer.from(material.ciphertext, "base64"),
      iv: Buffer.from(material.iv, "base64"),
      authTag: Buffer.from(material.tag, "base64"),
    }).toString("utf8");
  }
}
