import { zodResolver } from "@hookform/resolvers/zod";
import { type MetaFunction, useNavigate, useParams } from "@remix-run/react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useUpdateTenant } from "~/api/mutations/super-admin/useUpdateTenant";
import { useTenant } from "~/api/queries/super-admin/useTenant";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormMessage } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  editTenantFormSchema,
  type EditTenantFormValues,
} from "~/modules/SuperAdmin/schemas/tenant.schema";
import { setPageTitle } from "~/utils/setPageTitle";

import { TENANT_FORM_HANDLES, TENANT_PAGE_HANDLES } from "../../../e2e/data/tenants/handles";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.tenant");

import type { TenantStatus } from "@repo/shared";

export default function EditTenantPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { id: tenantId } = useParams();
  const { data: tenant, isLoading } = useTenant(tenantId ?? "");
  const { mutateAsync: updateTenant } = useUpdateTenant();

  const form = useForm<EditTenantFormValues>({
    resolver: zodResolver(editTenantFormSchema(t)),
  });

  useEffect(() => {
    if (!tenant) return;

    form.reset({
      name: tenant.name,
      host: tenant.host,
      status: tenant.status as TenantStatus,
    });
  }, [tenant, form]);

  const onSubmit = async (values: EditTenantFormValues) => {
    await updateTenant({
      id: tenantId || "",
      data: {
        ...values,
      },
    });

    navigate("/super-admin/tenants");
  };

  return (
    <PageWrapper>
      <div data-testid={TENANT_PAGE_HANDLES.PAGE} className="flex flex-col gap-y-6">
        <div>
          <h1 data-testid={TENANT_PAGE_HANDLES.HEADING} className="text-xl font-semibold">
            {t("superAdminTenantsView.edit.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("superAdminTenantsView.edit.description")}
          </p>
        </div>

        {isLoading ? (
          <div data-testid={TENANT_PAGE_HANDLES.LOADING} className="text-sm text-muted-foreground">
            {t("superAdminTenantsView.table.loading")}
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="name">{t("superAdminTenantsView.form.tenantName")}</Label>
                    <FormControl>
                      <Input data-testid={TENANT_FORM_HANDLES.NAME_INPUT} id="name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="host"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="host">{t("superAdminTenantsView.form.tenantHost")}</Label>
                    <FormControl>
                      <Input
                        data-testid={TENANT_FORM_HANDLES.HOST_INPUT}
                        id="host"
                        placeholder={t("superAdminTenantsView.form.tenantHostPlaceholder")}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <Label>{t("superAdminTenantsView.form.status")}</Label>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid={TENANT_FORM_HANDLES.STATUS_SELECT}>
                          <SelectValue
                            placeholder={t("superAdminTenantsView.form.statusPlaceholder")}
                          />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem
                          data-testid={TENANT_FORM_HANDLES.statusOption("active")}
                          value="active"
                        >
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
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end">
                <Button data-testid={TENANT_FORM_HANDLES.SUBMIT_BUTTON} type="submit">
                  {t("superAdminTenantsView.edit.submit")}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </div>
    </PageWrapper>
  );
}
