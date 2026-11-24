import { calculateTenantAllowedUsersCount } from "@repo/shared";
import { TriangleAlert } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

import { TENANT_FORM_HANDLES } from "../../../../e2e/data/tenants/handles";

import { AccessEndDatePicker } from "./AccessEndDatePicker";
import { TenantFormField } from "./TenantFormField";

import type { EditTenantFormValues } from "~/modules/SuperAdmin/schemas/tenant.schema";

type TenantDetailsFieldsProps = {
  /** Known only for an existing organization; enables the warning about a limit below current usage. */
  activeUsersCount?: number;
};

/** Name, host, status, access end and user capacity: shared by the create and edit organization pages. */
export function TenantDetailsFields({ activeUsersCount }: TenantDetailsFieldsProps) {
  const { t } = useTranslation();
  const { control, watch } = useFormContext<EditTenantFormValues>();
  const maxUsers = watch("maxUsers");
  const maxUsersOverflowPercentage = watch("maxUsersOverflowPercentage");
  const hasMaxUsers = Boolean(maxUsers);

  const allowedUsersCount = hasMaxUsers
    ? calculateTenantAllowedUsersCount(Number(maxUsers), Number(maxUsersOverflowPercentage || 0))
    : null;
  const excessUsersCount =
    activeUsersCount !== undefined && allowedUsersCount !== null
      ? activeUsersCount - allowedUsersCount
      : 0;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <TenantFormField
        control={control}
        name="name"
        label={t("superAdminTenantsView.form.tenantName")}
        renderControl={(field) => (
          <Input data-testid={TENANT_FORM_HANDLES.NAME_INPUT} id="name" {...field} />
        )}
      />
      <TenantFormField
        control={control}
        name="host"
        label={t("superAdminTenantsView.form.tenantHost")}
        renderControl={(field) => (
          <Input
            data-testid={TENANT_FORM_HANDLES.HOST_INPUT}
            id="host"
            placeholder={t("superAdminTenantsView.form.tenantHostPlaceholder")}
            {...field}
          />
        )}
      />
      <TenantFormField
        control={control}
        name="status"
        label={t("superAdminTenantsView.form.status")}
        renderControl={(field) => (
          <Select onValueChange={field.onChange} value={field.value}>
            <SelectTrigger id="status" data-testid={TENANT_FORM_HANDLES.STATUS_SELECT}>
              <SelectValue placeholder={t("superAdminTenantsView.form.statusPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem data-testid={TENANT_FORM_HANDLES.statusOption("active")} value="active">
                {t("superAdminTenantsView.status.active")}
              </SelectItem>
              <SelectItem
                data-testid={TENANT_FORM_HANDLES.statusOption("inactive")}
                value="inactive"
              >
                {t("superAdminTenantsView.status.inactive")}
              </SelectItem>
            </SelectContent>
          </Select>
        )}
      />
      <TenantFormField
        control={control}
        name="accessEndsAt"
        label={t("superAdminTenantsView.form.accessEndsAt")}
        hint={t("superAdminTenantsView.form.accessEndsAtHint")}
        renderControl={(field) => (
          <AccessEndDatePicker
            id="accessEndsAt"
            value={field.value ?? ""}
            onChange={field.onChange}
          />
        )}
      />
      <TenantFormField
        control={control}
        name="maxUsers"
        label={t("superAdminTenantsView.form.maxUsers")}
        hint={t("superAdminTenantsView.form.maxUsersHint")}
        renderControl={(field) => (
          <Input
            data-testid={TENANT_FORM_HANDLES.MAX_USERS_INPUT}
            id="maxUsers"
            type="number"
            min={1}
            step={1}
            placeholder={t("superAdminTenantsView.form.maxUsersPlaceholder")}
            {...field}
            value={field.value ?? ""}
          />
        )}
      />
      <TenantFormField
        control={control}
        name="maxUsersOverflowPercentage"
        label={t("superAdminTenantsView.form.maxUsersOverflowPercentage")}
        hint={t("superAdminTenantsView.form.maxUsersOverflowPercentageHint")}
        renderControl={(field) => (
          <Input
            data-testid={TENANT_FORM_HANDLES.MAX_USERS_OVERFLOW_PERCENTAGE_INPUT}
            id="maxUsersOverflowPercentage"
            type="number"
            min={0}
            max={100}
            step={1}
            disabled={!hasMaxUsers}
            placeholder="0"
            {...field}
            value={field.value ?? ""}
          />
        )}
      />
      {excessUsersCount > 0 && (
        <div
          data-testid={TENANT_FORM_HANDLES.USER_LIMIT_BELOW_USAGE_WARNING}
          className="flex items-start gap-2 rounded-lg border border-warning-200 bg-warning-50 p-3 text-sm text-warning-900 md:col-span-2"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            {t("superAdminTenantsView.form.userLimitBelowUsage", {
              activeUsersCount,
              allowedUsersCount,
              excessUsersCount,
            })}
          </p>
        </div>
      )}
    </div>
  );
}
