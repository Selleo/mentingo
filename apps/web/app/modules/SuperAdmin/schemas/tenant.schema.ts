import { z } from "zod";

import type i18next from "i18next";

export const createTenantFormSchema = (t: typeof i18next.t) =>
  z.object({
    name: z.string().min(1, t("superAdminTenantsView.validation.nameRequired")),
    host: z.string().url(t("superAdminTenantsView.validation.hostInvalid")),
    status: z.enum(["active", "inactive"]).default("active"),
    adminEmail: z.string().email(t("superAdminTenantsView.validation.adminEmailRequired")),
    adminFirstName: z.string().min(1, t("superAdminTenantsView.validation.adminFirstNameRequired")),
    adminLastName: z.string().min(1, t("superAdminTenantsView.validation.adminLastNameRequired")),
  });

export type CreateTenantFormValues = z.infer<ReturnType<typeof createTenantFormSchema>>;

export const editTenantFormSchema = (t: typeof i18next.t) =>
  z.object({
    name: z.string().min(1, t("superAdminTenantsView.validation.nameRequired")),
    host: z.string().url(t("superAdminTenantsView.validation.hostInvalid")),
    status: z.enum(["active", "inactive"]),
  });

export type EditTenantFormValues = z.infer<ReturnType<typeof editTenantFormSchema>>;
