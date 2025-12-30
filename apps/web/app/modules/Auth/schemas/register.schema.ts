import { z } from "zod";

import { passwordSchema } from "~/modules/Dashboard/Settings/schema/password.schema";
import { SUPPORTED_LANGUAGES } from "~/utils/browser-language";

import { calculateAge } from "../utils/birthday";

import type i18next from "i18next";

export const makeRegisterSchema = (t: typeof i18next.t, ageLimit?: number) =>
  z
    .object({
      firstName: z.string().min(2, { message: t("registerView.validation.firstName") }),
      lastName: z.string().min(2, { message: t("registerView.validation.lastName") }),
      email: z.string().email({ message: t("registerView.validation.email") }),
      password: passwordSchema,
      language: z.enum([...SUPPORTED_LANGUAGES] as [string, ...string[]]),
      birthday: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (!ageLimit) return; // no rule to apply

      const age = calculateAge(data.birthday);

      if (!age || age < ageLimit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["birthday"],
          message: t("registerView.validation.birthday", { ageLimit }),
        });
      }
    });
