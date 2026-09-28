import type { PhoneAuthConfig } from "./phone-auth.types";

const readOptional = (value: string | undefined) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

/**
 * Phone auth configuration is read from env at call time so the feature flag can be toggled
 * per process (and per test) without rebuilding the Nest config tree.
 */
export const readPhoneAuthConfig = (env: NodeJS.ProcessEnv = process.env): PhoneAuthConfig => {
  const isProduction = env.NODE_ENV === "production";
  const smsRuApiId = readOptional(env.SMSRU_API_ID);
  const flagEnabled = env.PHONE_AUTH_ENABLED === "true";

  return {
    // In production the feature needs a real SMS provider; the console provider is dev-only.
    enabled: flagEnabled && (!isProduction || Boolean(smsRuApiId)),
    isProduction,
    smsRuApiId,
    smsSender: readOptional(env.SMS_SENDER),
    otpSecret: readOptional(env.PHONE_OTP_SECRET) ?? env.JWT_SECRET ?? "",
  };
};
