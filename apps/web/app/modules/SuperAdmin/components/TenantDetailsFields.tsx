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

/** Name, host, status and access end: shared by the create and edit organization pages. */
export function TenantDetailsFields() {
  const { t } = useTranslation();
  const { control } = useFormContext<EditTenantFormValues>();

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
    </div>
  );
}
