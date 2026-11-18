import { zodResolver } from "@hookform/resolvers/zod";
import { type MetaFunction, useNavigate, useParams } from "@remix-run/react";
import { TENANT_STATUSES } from "@repo/shared";
import { Building2 } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { match } from "ts-pattern";

import { useUpdateTenant } from "~/api/mutations/super-admin/useUpdateTenant";
import { useTenant } from "~/api/queries/super-admin/useTenant";
import { PageWrapper } from "~/components/PageWrapper";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Form } from "~/components/ui/form";
import Loader from "~/modules/common/Loader/Loader";
import { TenantDetailsFields } from "~/modules/SuperAdmin/components/TenantDetailsFields";
import {
  editTenantFormSchema,
  type EditTenantFormValues,
} from "~/modules/SuperAdmin/schemas/tenant.schema";
import { TENANTS_PATH } from "~/modules/SuperAdmin/tenantsTable.constants";
import {
  hasAccessEnded,
  toAccessEndDate,
  toAccessEndsAt,
} from "~/modules/SuperAdmin/utils/accessEnd.utils";
import { setPageTitle } from "~/utils/setPageTitle";

import { TENANT_FORM_HANDLES, TENANT_PAGE_HANDLES } from "../../../e2e/data/tenants/handles";

import type { TenantStatus } from "@repo/shared";

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.tenant");

const TENANT_STANDINGS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  ACCESS_ENDED: "accessEnded",
} as const;

export default function EditTenantPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { id: tenantId } = useParams();
  const { data: tenant, isLoading } = useTenant(tenantId ?? "");
  const { mutateAsync: updateTenant, isPending } = useUpdateTenant();

  const form = useForm<EditTenantFormValues>({
    resolver: zodResolver(editTenantFormSchema(t)),
  });

  useEffect(() => {
    if (!tenant) return;

    form.reset({
      name: tenant.name,
      host: tenant.host,
      status: tenant.status as TenantStatus,
      accessEndsAt: toAccessEndDate(tenant.accessEndsAt),
    });
  }, [tenant, form]);

  const onSubmit = async ({ accessEndsAt, ...values }: EditTenantFormValues) => {
    await updateTenant({
      id: tenantId ?? "",
      data: { ...values, accessEndsAt: toAccessEndsAt(accessEndsAt) },
    });

    navigate(TENANTS_PATH);
  };

  const breadcrumbs = [
    { title: t("superAdminTenantsView.title"), href: TENANTS_PATH },
    { title: t("superAdminTenantsView.edit.title"), href: `${TENANTS_PATH}/${tenantId ?? ""}` },
  ];

  if (isLoading || !tenant)
    return (
      <PageWrapper breadcrumbs={breadcrumbs}>
        <div
          data-testid={TENANT_PAGE_HANDLES.LOADING}
          className="flex h-full items-center justify-center"
        >
          <Loader />
        </div>
      </PageWrapper>
    );

  const standing = match({
    isInactive: tenant.status === TENANT_STATUSES.INACTIVE,
    accessEnded: hasAccessEnded(tenant.accessEndsAt),
  })
    .with({ isInactive: true }, () => TENANT_STANDINGS.INACTIVE)
    .with({ accessEnded: true }, () => TENANT_STANDINGS.ACCESS_ENDED)
    .otherwise(() => TENANT_STANDINGS.ACTIVE);

  const accessSummary = tenant.accessEndsAt
    ? t("superAdminTenantsView.edit.accessEndsOn", {
        date: new Date(tenant.accessEndsAt).toLocaleString(),
      })
    : t("superAdminTenantsView.edit.unlimitedAccess");

  return (
    <PageWrapper breadcrumbs={breadcrumbs}>
      <div data-testid={TENANT_PAGE_HANDLES.PAGE} className="flex flex-col gap-6">
        <div className="rounded-xl border bg-gradient-to-r from-neutral-50 to-background p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2 text-neutral-900">
                <Building2 className="size-7 text-primary-700" />
                <h2 data-testid={TENANT_PAGE_HANDLES.HEADING} className="h4 text-neutral-950">
                  {tenant.name}
                </h2>
              </div>
              <p className="text-sm text-neutral-600">
                {tenant.host} · {accessSummary}
              </p>
            </div>
            <Badge
              data-testid={TENANT_PAGE_HANDLES.STATUS_BADGE}
              variant={standing === TENANT_STANDINGS.ACTIVE ? "secondary" : "outline"}
            >
              {t(`superAdminTenantsView.standing.${standing}`)}
            </Badge>
          </div>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="rounded-xl border bg-background p-5 shadow-sm"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="h5 text-neutral-950">{t("superAdminTenantsView.edit.title")}</h3>
                <p className="text-sm text-neutral-600">
                  {t("superAdminTenantsView.edit.description")}
                </p>
              </div>
              <Button
                data-testid={TENANT_FORM_HANDLES.SUBMIT_BUTTON}
                type="submit"
                disabled={!form.formState.isDirty || isPending}
                className="min-w-28"
              >
                {t("superAdminTenantsView.edit.submit")}
              </Button>
            </div>
            <TenantDetailsFields />
          </form>
        </Form>
      </div>
    </PageWrapper>
  );
}
