import { readPhoneAuthConfig } from "../phone-auth.config";

import { LogSmsProvider } from "./log-sms.provider";
import { SmsRuProvider } from "./smsru.provider";

import type { PhoneAuthConfig, SmsProvider } from "../phone-auth.types";

/**
 * Chooses the SMS provider:
 * - SMSRU_API_ID set -> SMS.RU (any environment);
 * - otherwise, outside production -> console logger for local development;
 * - otherwise (production without credentials) -> a provider that always fails.
 *   The feature itself is reported as disabled in that case (see readPhoneAuthConfig).
 */
export const createSmsProvider = (config: PhoneAuthConfig = readPhoneAuthConfig()): SmsProvider => {
  if (config.smsRuApiId) return new SmsRuProvider(config.smsRuApiId, config.smsSender);

  if (!config.isProduction) return new LogSmsProvider(false);

  return {
    name: "unconfigured",
    send: async () => {
      throw new Error("SMS provider is not configured (SMSRU_API_ID is missing)");
    },
  };
};
