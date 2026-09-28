import { Logger } from "@nestjs/common";

import { maskPhone } from "../phone.utils";

import type { SmsMessage, SmsProvider, SmsSendResult } from "../phone-auth.types";

/**
 * Development-only provider: prints the SMS text (including the one-time code) to the console.
 * It refuses to run in production so codes can never leak into production logs.
 */
export class LogSmsProvider implements SmsProvider {
  readonly name = "log";

  private readonly logger = new Logger("LogSmsProvider");

  constructor(private readonly isProduction: boolean) {
    if (isProduction) throw new Error("LogSmsProvider must not be used in production");
  }

  async send({ to, text }: SmsMessage): Promise<SmsSendResult> {
    if (this.isProduction) throw new Error("LogSmsProvider must not be used in production");

    this.logger.warn(`[DEV SMS] to ${maskPhone(to)}: ${text}`);

    return {};
  }
}
