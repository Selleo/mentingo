import { z } from "zod";

import type i18next from "i18next";

export const coursePricingFormSchema = (t: typeof i18next.t) =>
  z
    .object({
      priceInCents: z.number().optional(),
      currency: z.string().optional().default("rub"),
      isFree: z.boolean().default(false),
    })
    .superRefine((data, ctx) => {
      if (data.isFree) {
        data.priceInCents = 0;
      } else {
        if (!data.priceInCents || data.priceInCents < 200) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("adminCourseView.pricing.validation.priceInCents"),
            path: ["priceInCents"],
          });
        }
      }
    });

export type CoursePricingFormValues = z.infer<ReturnType<typeof coursePricingFormSchema>>;
