import { AxiosError } from "axios";
import { z } from "zod";

import type { TFunction } from "i18next";
import type { ApiErrorResponse } from "~/api/types";

export const PHONE_OTP_CODE_LENGTH = 6;

const PHONE_INPUT_PATTERN = /^\+?[\d\s()\-.]{5,32}$/;

export const phoneInputSchema = (t: TFunction) =>
  z
    .string()
    .trim()
    .regex(PHONE_INPUT_PATTERN, { message: t("phoneAuth.validation.phone") })
    .refine((value) => value.replace(/\D/g, "").length >= 8, {
      message: t("phoneAuth.validation.phone"),
    });

export const otpCodeSchema = (t: TFunction) =>
  z.string().regex(new RegExp(`^\\d{${PHONE_OTP_CODE_LENGTH}}$`), {
    message: t("phoneAuth.validation.code"),
  });

export const phoneRequestSchema = (t: TFunction) => z.object({ phone: phoneInputSchema(t) });

export const phoneVerifySchema = (t: TFunction) =>
  z.object({ code: otpCodeSchema(t), rememberMe: z.boolean().optional() });

export type PhoneRequestFormValues = z.infer<ReturnType<typeof phoneRequestSchema>>;
export type PhoneVerifyFormValues = z.infer<ReturnType<typeof phoneVerifySchema>>;

/** Seconds until another code may be requested, taken from a 429 API error (if any). */
export const getRetryAfterSeconds = (error: unknown): number | null => {
  if (!(error instanceof AxiosError) || error.response?.status !== 429) return null;

  const retryAfterSeconds = (error.response?.data as ApiErrorResponse | undefined)
    ?.retryAfterSeconds;

  return typeof retryAfterSeconds === "number" ? retryAfterSeconds : null;
};
