import { z } from "zod";

import type i18next from "i18next";

const MAX_USERS_OVERFLOW_PERCENTAGE_LIMIT = 100;

const isWholeNumberInRange = (value: string, minimum: number, maximum?: number) => {
  const parsedValue = Number(value);

  return (
    Number.isInteger(parsedValue) &&
    parsedValue >= minimum &&
    (maximum === undefined || parsedValue <= maximum)
  );
};

const createUserCapacityFields = (t: typeof i18next.t) => ({
  maxUsers: z
    .string()
    .optional()
    .refine(
      (value) => !value || isWholeNumberInRange(value, 1),
      t("superAdminTenantsView.validation.maxUsersInvalid"),
    ),
  maxUsersOverflowPercentage: z
    .string()
    .optional()
    .refine(
      (value) => !value || isWholeNumberInRange(value, 0, MAX_USERS_OVERFLOW_PERCENTAGE_LIMIT),
      t("superAdminTenantsView.validation.maxUsersOverflowPercentageInvalid"),
    ),
});

export const createTenantFormSchema = (t: typeof i18next.t) =>
  z.object({
    name: z.string().min(1, t("superAdminTenantsView.validation.nameRequired")),
    host: z.string().url(t("superAdminTenantsView.validation.hostInvalid")),
    status: z.enum(["active", "inactive"]).default("active"),
    accessEndsAt: z.string().optional(),
    ...createUserCapacityFields(t),
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
    accessEndsAt: z.string().optional(),
    ...createUserCapacityFields(t),
  });

export type EditTenantFormValues = z.infer<ReturnType<typeof editTenantFormSchema>>;
