import { z } from "zod";

import type i18next from "i18next";

export const companyInformationFormSchema = (t: typeof i18next.t) =>
  z.object({
    company_name: z.string().optional(),
    registered_address: z.string().optional(),
    tax_number: z
      .string()
      .regex(/^\d{10}$/, t("providerInformation.validation.nipMustBe10Digits"))
      .optional()
      .or(z.literal("")),
    email_address: z
      .string()
      .email(t("providerInformation.validation.invalidEmailFormat"))
      .optional()
      .or(z.literal("")),
    court_register_number: z
      .string()
      .regex(/^\d{10}$/, t("providerInformation.validation.krsMustBe10Digits"))
      .optional()
      .or(z.literal("")),
  });

export type CompanyInformationFormValues = z.infer<ReturnType<typeof companyInformationFormSchema>>;
