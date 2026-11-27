import { zodResolver } from "@hookform/resolvers/zod";
import { type MetaFunction, useNavigate } from "@remix-run/react";
import { TENANT_STATUSES } from "@repo/shared";
import { Building2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useCreateTenant } from "~/api/mutations/super-admin/useCreateTenant";
import { queryClient } from "~/api/queryClient";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Form } from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { TenantDetailsFields } from "~/modules/SuperAdmin/components/TenantDetailsFields";
import { TenantFormField } from "~/modules/SuperAdmin/components/TenantFormField";
import {
  type CreateTenantFormValues,
  createTenantFormSchema,
} from "~/modules/SuperAdmin/schemas/tenant.schema";
import { TENANTS_PATH } from "~/modules/SuperAdmin/tenantsTable.constants";
import { toAccessEndsAt } from "~/modules/SuperAdmin/utils/accessEnd.utils";
import {
  toMaxUsers,
  toMaxUsersOverflowPercentage,
} from "~/modules/SuperAdmin/utils/userCapacity.utils";
import { setPageTitle } from "~/utils/setPageTitle";

import { CREATE_TENANT_PAGE_HANDLES, TENANT_FORM_HANDLES } from "../../../e2e/data/tenants/handles";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.createTenant");

export default function CreateTenantPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { mutateAsync: createTenant, isPending } = useCreateTenant();

  const form = useForm<CreateTenantFormValues>({
    resolver: zodResolver(createTenantFormSchema(t)),
    defaultValues: {
      name: "",
      host: "",
      status: TENANT_STATUSES.ACTIVE,
      accessEndsAt: "",
      maxUsers: "",
      maxUsersOverflowPercentage: "",
      adminFirstName: "",
      adminLastName: "",
      adminEmail: "",
    },
  });

  const onSubmit = async ({
    accessEndsAt,
    maxUsers,
    maxUsersOverflowPercentage,
    ...tenant
  }: CreateTenantFormValues) => {
    await createTenant({
      data: {
        ...tenant,
        accessEndsAt: toAccessEndsAt(accessEndsAt),
        maxUsers: toMaxUsers(maxUsers),
        maxUsersOverflowPercentage: toMaxUsersOverflowPercentage(maxUsersOverflowPercentage),
      },
    });

    queryClient.invalidateQueries({ queryKey: ["superAdminTenants"] });
    navigate(TENANTS_PATH);
  };

  return (
    <PageWrapper
      breadcrumbs={[
        { title: t("superAdminTenantsView.title"), href: TENANTS_PATH },
        { title: t("superAdminTenantsView.create.title"), href: `${TENANTS_PATH}/new` },
      ]}
    >
      <div data-testid={CREATE_TENANT_PAGE_HANDLES.PAGE} className="flex flex-col gap-6">
        <div className="rounded-xl border bg-gradient-to-r from-neutral-50 to-background p-5 shadow-sm">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-neutral-900">
              <Building2 className="size-7 text-primary-700" />
              <h2 data-testid={CREATE_TENANT_PAGE_HANDLES.HEADING} className="h4 text-neutral-950">
                {t("superAdminTenantsView.create.title")}
              </h2>
            </div>
            <p className="text-sm text-neutral-600">
              {t("superAdminTenantsView.create.description")}
            </p>
          </div>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="rounded-xl border bg-background p-5 shadow-sm"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="h5 text-neutral-950">
                {t("superAdminTenantsView.form.sections.organization")}
              </h3>
              <Button
                data-testid={TENANT_FORM_HANDLES.SUBMIT_BUTTON}
                type="submit"
                disabled={isPending}
                className="min-w-28"
              >
                {t("superAdminTenantsView.create.submit")}
              </Button>
            </div>
            <TenantDetailsFields />

            <section className="-mx-5 mt-6 border-t border-neutral-200 px-5 pt-5">
              <h3 className="h5 mb-4 text-neutral-950">
                {t("superAdminTenantsView.form.sections.firstAdmin")}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <TenantFormField
                  control={form.control}
                  name="adminFirstName"
                  label={t("superAdminTenantsView.form.adminFirstName")}
                  renderControl={(field) => (
                    <Input
                      data-testid={TENANT_FORM_HANDLES.ADMIN_FIRST_NAME_INPUT}
                      id="adminFirstName"
                      {...field}
                    />
                  )}
                />
                <TenantFormField
                  control={form.control}
                  name="adminLastName"
                  label={t("superAdminTenantsView.form.adminLastName")}
                  renderControl={(field) => (
                    <Input
                      data-testid={TENANT_FORM_HANDLES.ADMIN_LAST_NAME_INPUT}
                      id="adminLastName"
                      {...field}
                    />
                  )}
                />
                <TenantFormField
                  control={form.control}
                  name="adminEmail"
                  label={t("superAdminTenantsView.form.adminEmail")}
                  className="md:col-span-2"
                  renderControl={(field) => (
                    <Input
                      data-testid={TENANT_FORM_HANDLES.ADMIN_EMAIL_INPUT}
                      id="adminEmail"
                      type="email"
                      {...field}
                    />
                  )}
                />
              </div>
            </section>
          </form>
        </Form>
      </div>
    </PageWrapper>
  );
}
