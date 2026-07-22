import crypto from "node:crypto";

import { Injectable } from "@nestjs/common";

import { decryptWithAesGcm, encryptWithAesGcm } from "src/common/utils/aesGcm";

import type { EncryptedMicrosoftRefreshToken } from "../types/microsoft-calendar.types";

@Injectable()
export class MicrosoftCalendarTokenEncryptionService {
  private readonly keyEncryptionKey: Buffer;

  constructor() {
    this.keyEncryptionKey = Buffer.from(process.env.MASTER_KEY ?? "", "base64");

    if (this.keyEncryptionKey.length !== 32) {
      throw new Error("MASTER_KEY must be a base64-encoded 32-byte key");
    }
  }

  encrypt(refreshToken: string): EncryptedMicrosoftRefreshToken {
    const dataEncryptionKey = crypto.randomBytes(32);

    const encryptedToken = encryptWithAesGcm(dataEncryptionKey, refreshToken);
    const encryptedDek = encryptWithAesGcm(this.keyEncryptionKey, dataEncryptionKey);

    return {
      refreshTokenCiphertext: encryptedToken.ciphertext.toString("base64"),
      refreshTokenIv: encryptedToken.iv.toString("base64"),
      refreshTokenTag: encryptedToken.authTag.toString("base64"),
      refreshTokenEncryptedDek: encryptedDek.ciphertext.toString("base64"),
      refreshTokenEncryptedDekIv: encryptedDek.iv.toString("base64"),
      refreshTokenEncryptedDekTag: encryptedDek.authTag.toString("base64"),
    };
  }

  decrypt(encrypted: EncryptedMicrosoftRefreshToken): string {
    const dataEncryptionKey = decryptWithAesGcm(this.keyEncryptionKey, {
      ciphertext: Buffer.from(encrypted.refreshTokenEncryptedDek, "base64"),
      iv: Buffer.from(encrypted.refreshTokenEncryptedDekIv, "base64"),
      authTag: Buffer.from(encrypted.refreshTokenEncryptedDekTag, "base64"),
    });
    const refreshToken = decryptWithAesGcm(dataEncryptionKey, {
      ciphertext: Buffer.from(encrypted.refreshTokenCiphertext, "base64"),
      iv: Buffer.from(encrypted.refreshTokenIv, "base64"),
      authTag: Buffer.from(encrypted.refreshTokenTag, "base64"),
    });

    return refreshToken.toString("utf8");
  }
}
