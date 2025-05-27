import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ModuleRef } from "@nestjs/core";
import { match, P } from "ts-pattern";

import { LocalAdapter } from "../adapters/local.adapter";
import { MailgunAdapter } from "../adapters/mailgun.adapter";
import { AWSSESAdapter } from "../adapters/ses.adapter";
import { SmtpAdapter } from "../adapters/smtp.adapter";

import type { EmailAdapter } from "../adapters/email.adapter";
import type { EmailConfigSchema } from "src/common/configuration/email";

type AdapterType = EmailConfigSchema["EMAIL_ADAPTER"];

@Injectable()
export class EmailAdapterFactory {
  constructor(
    private moduleRef: ModuleRef,
    private configService: ConfigService,
  ) {}

  async createAdapter(): Promise<EmailAdapter> {
    const adapterType = this.configService.get<AdapterType>("EMAIL_ADAPTER");
    const adapter = match(adapterType)
      .with("mailhog", () => LocalAdapter)
      .with("smtp", () => SmtpAdapter)
      .with("ses", () => AWSSESAdapter)
      .with("mailgun", () => MailgunAdapter)
      .with(P.nullish, () => {
        throw new Error("EMAIL_ADAPTER is not defined in configuration");
      })
      .otherwise((type) => {
        throw new Error(`Unknown email adapter type: ${type}`);
      });

    return await this.moduleRef.create<EmailAdapter>(adapter);
  }
}
