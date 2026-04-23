import { zodResolver } from "@hookform/resolvers/zod";
import { type MetaFunction, useNavigate } from "@remix-run/react";
import { TENANT_STATUSES } from "@repo/shared";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useCreateTenant } from "~/api/mutations/super-admin/useCreateTenant";
import { queryClient } from "~/api/queryClient";
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
  type CreateTenantFormValues,
  createTenantFormSchema,
} from "~/modules/SuperAdmin/schemas/tenant.schema";
import { setPageTitle } from "~/utils/setPageTitle";

import { CREATE_TENANT_PAGE_HANDLES, TENANT_FORM_HANDLES } from "../../../e2e/data/tenants/handles";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.createTenant");

export default function CreateTenantPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { mutateAsync: createTenant } = useCreateTenant();

  const form = useForm<CreateTenantFormValues>({
    resolver: zodResolver(createTenantFormSchema(t)),
    defaultValues: {
      status: TENANT_STATUSES.ACTIVE,
    },
  });

  const onSubmit = async (tenant: CreateTenantFormValues) => {
    await createTenant({
      data: {
        ...tenant,
      },
    });

    queryClient.invalidateQueries({ queryKey: ["superAdminTenants"] });
    navigate("/super-admin/tenants");
  };

  return (
    <PageWrapper>
      <div data-testid={CREATE_TENANT_PAGE_HANDLES.PAGE} className="flex flex-col gap-y-6">
        <div>
          <h1 data-testid={CREATE_TENANT_PAGE_HANDLES.HEADING} className="text-xl font-semibold">
            {t("superAdminTenantsView.create.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("superAdminTenantsView.create.description")}
          </p>
        </div>

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
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
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

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="adminFirstName"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="adminFirstName">
                      {t("superAdminTenantsView.form.adminFirstName")}
                    </Label>
                    <FormControl>
                      <Input
                        data-testid={TENANT_FORM_HANDLES.ADMIN_FIRST_NAME_INPUT}
                        id="adminFirstName"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="adminLastName"
                render={({ field }) => (
                  <FormItem>
                    <Label htmlFor="adminLastName">
                      {t("superAdminTenantsView.form.adminLastName")}
                    </Label>
                    <FormControl>
                      <Input
                        data-testid={TENANT_FORM_HANDLES.ADMIN_LAST_NAME_INPUT}
                        id="adminLastName"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="adminEmail"
              render={({ field }) => (
                <FormItem>
                  <Label htmlFor="adminEmail">{t("superAdminTenantsView.form.adminEmail")}</Label>
                  <FormControl>
                    <Input
                      data-testid={TENANT_FORM_HANDLES.ADMIN_EMAIL_INPUT}
                      id="adminEmail"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end">
              <Button data-testid={TENANT_FORM_HANDLES.SUBMIT_BUTTON} type="submit">
                {t("superAdminTenantsView.create.submit")}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </PageWrapper>
  );
}
