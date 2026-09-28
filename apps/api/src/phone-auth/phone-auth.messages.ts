import { SUPPORTED_LANGUAGES } from "@repo/shared";

import { PHONE_OTP_PURPOSE } from "./phone-auth.constants";

import type { PhoneOtpPurpose } from "./phone-auth.types";

type SmsTemplate = (code: string) => string;

const RU_TEMPLATES: Record<PhoneOtpPurpose, SmsTemplate> = {
  [PHONE_OTP_PURPOSE.LOGIN]: (code) => `Код входа в LMS: ${code}. Никому не сообщайте его.`,
  [PHONE_OTP_PURPOSE.ATTACH]: (code) =>
    `Код подтверждения телефона в LMS: ${code}. Никому не сообщайте его.`,
};

const EN_TEMPLATES: Record<PhoneOtpPurpose, SmsTemplate> = {
  [PHONE_OTP_PURPOSE.LOGIN]: (code) => `LMS sign-in code: ${code}. Do not share it with anyone.`,
  [PHONE_OTP_PURPOSE.ATTACH]: (code) =>
    `LMS phone verification code: ${code}. Do not share it with anyone.`,
};

/** Russian is the default for this deployment; English is used for English-speaking users. */
export const buildOtpSmsText = (
  purpose: PhoneOtpPurpose,
  code: string,
  language?: string | null,
): string => {
  const templates = language === SUPPORTED_LANGUAGES.EN ? EN_TEMPLATES : RU_TEMPLATES;

  return templates[purpose](code);
};
