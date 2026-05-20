import { CERTIFICATE_VALIDITY_TYPES, CERTIFICATE_VALIDITY_UNITS } from "@repo/shared";
import { z } from "zod";

import type i18next from "i18next";

export const certificateValidityFormSchema = (t: typeof i18next.t) =>
  z
    .object({
      isValidityEnabled: z.boolean(),
      validityType: z.nativeEnum(CERTIFICATE_VALIDITY_TYPES),
      validityValue: z.number().min(1),
      validityUnit: z.nativeEnum(CERTIFICATE_VALIDITY_UNITS),
      validityDate: z.string(),
    })
    .superRefine((values, context) => {
      if (!values.isValidityEnabled) return;
      if (values.validityType !== CERTIFICATE_VALIDITY_TYPES.FIXED_DATE) return;
      if (values.validityDate) return;

      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["validityDate"],
        message: t("adminCourseView.settings.validation.validityDateRequired"),
      });
    });

export type CertificateValidityFormValues = z.infer<
  ReturnType<typeof certificateValidityFormSchema>
>;
