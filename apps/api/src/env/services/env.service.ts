import crypto from "crypto";

import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { ALLOWED_SECRETS, ENCRYPTION_ALG } from "src/env/env.config";
import { EnvRepository } from "src/env/repositories/env.repository";

import type { BulkUpsertEnvBody, EncryptedEnvBody } from "src/env/env.schema";

@Injectable()
export class EnvService {
  private readonly KEY_ENCRYPTION_KEY;
  constructor(private readonly envRepository: EnvRepository) {
    this.KEY_ENCRYPTION_KEY = Buffer.from(process.env.MASTER_KEY!, "base64");
  }

  async bulkUpsertEnv(data: BulkUpsertEnvBody) {
    const processedEnvs: EncryptedEnvBody[] = [];
    for (const env of data) {
      if (!ALLOWED_SECRETS.includes(env.name)) {
        throw new BadRequestException("Secret not supported");
      }
      const dek = crypto.randomBytes(32);
      const iv = crypto.randomBytes(12);

      const cipher = crypto.createCipheriv(ENCRYPTION_ALG, dek, iv);

      const ciphertext = Buffer.concat([cipher.update(env.value, "utf8"), cipher.final()]);

      const tag = cipher.getAuthTag();

      const dekIv = crypto.randomBytes(12);
      const dekCipher = crypto.createCipheriv(ENCRYPTION_ALG, this.KEY_ENCRYPTION_KEY, dekIv);

      const encryptedDek = Buffer.concat([dekCipher.update(dek), dekCipher.final()]);

      const dekTag = dekCipher.getAuthTag();

      processedEnvs.push({
        name: env.name,
        iv: iv.toString("base64"),
        ciphertext: ciphertext.toString("base64"),
        tag: tag.toString("base64"),
        dekIv: dekIv.toString("base64"),
        encryptedDek: encryptedDek.toString("base64"),
        dekTag: dekTag.toString("base64"),
      });
    }

    await this.envRepository.bulkUpsertEnv(processedEnvs);
  }

  async getEnv(envName: string) {
    const env = await this.envRepository.getEnv(envName);

    if (!env) throw new NotFoundException("Secret not found");

    const decipherDek = crypto.createDecipheriv(
      ENCRYPTION_ALG,
      this.KEY_ENCRYPTION_KEY,
      Buffer.from(env.encryptedDekIV, "base64"),
    );

    decipherDek.setAuthTag(Buffer.from(env.encryptedDekTag, "base64"));

    const dek = Buffer.concat([
      decipherDek.update(Buffer.from(env.encryptedDek, "base64")),
      decipherDek.final(),
    ]);

    const decipherCiphertext = crypto.createDecipheriv(
      ENCRYPTION_ALG,
      dek,
      Buffer.from(env.iv, "base64"),
    );
    decipherCiphertext.setAuthTag(Buffer.from(env.tag, "base64"));

    const plaintext = Buffer.concat([
      decipherCiphertext.update(Buffer.from(env.ciphertext, "base64")),
      decipherCiphertext.final(),
    ]).toString("utf8");

    return { name: envName, value: plaintext };
  }

  async getSSOEnabled() {
    const [google, microsoft, slack] = await Promise.all([
      this.getEnv("VITE_GOOGLE_OAUTH_ENABLED")
        .then((r) => r.value)
        .catch(() => undefined),

      this.getEnv("VITE_MICROSOFT_OAUTH_ENABLED")
        .then((r) => r.value)
        .catch(() => undefined),

      this.getEnv("VITE_SLACK_OAUTH_ENABLED")
        .then((r) => r.value)
        .catch(() => undefined),
    ]);

    return {
      google,
      microsoft,
      slack,
    };
  }

  async getStripePublishableKey() {
    const stripePublishableKey = await this.getEnv("VITE_STRIPE_PUBLISHABLE_KEY")
      .then((r) => r.value)
      .catch(() => null);

    return stripePublishableKey;
  }
}
