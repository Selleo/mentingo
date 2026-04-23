import { Link } from "@remix-run/react";
import { HandHelping, Pencil } from "lucide-react";

import { Button } from "~/components/ui/button";

import { TENANTS_PAGE_HANDLES } from "../../../e2e/data/tenants/handles";

import type { ColumnDef } from "@tanstack/react-table";
import type i18next from "i18next";
import type { FindAllTenantsResponse } from "~/api/generated-api";

export type Tenant = FindAllTenantsResponse["data"][number] & { isCurrentTenant?: boolean };

export const getTenantsColumns = (
  t: typeof i18next.t,
  onSupportLogin: (tenantId: string) => Promise<void>,
  isSupportLoginLoading: boolean,
): ColumnDef<Tenant>[] => [
  {
    accessorKey: "name",
    header: t("superAdminTenantsView.table.name"),
  },
  {
    accessorKey: "host",
    header: t("superAdminTenantsView.table.host"),
  },
  {
    accessorKey: "status",
    header: t("superAdminTenantsView.table.status"),
    cell: ({ row }) =>
      row.original.status === "active"
        ? t("superAdminTenantsView.status.active")
        : t("superAdminTenantsView.status.inactive"),
  },
  {
    accessorKey: "isManaging",
    header: t("superAdminTenantsView.table.managing"),
    cell: ({ row }) =>
      row.original.isManaging
        ? t("superAdminTenantsView.table.yes")
        : t("superAdminTenantsView.table.no"),
  },
  {
    id: "actions",
    header: () => (
      <div className="text-right">{t("superAdminTenantsView.table.actions.title")}</div>
    ),
    cell: ({ row }) => (
      <div className="text-right flex items-center justify-end gap-2">
        {!row.original.isCurrentTenant && (
          <Button
            data-testid={TENANTS_PAGE_HANDLES.supportModeButton(row.original.id)}
            size="sm"
            className="gap-2"
            onClick={() => onSupportLogin(row.original.id)}
            disabled={isSupportLoginLoading}
          >
            <HandHelping className="size-4" aria-hidden="true" />
            {t("superAdminTenantsView.table.actions.enterSupportMode")}
          </Button>
        )}
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link
            data-testid={TENANTS_PAGE_HANDLES.editButton(row.original.id)}
            to={`/super-admin/tenants/${row.original.id}`}
          >
            <Pencil className="size-4" aria-hidden="true" />
            {t("superAdminTenantsView.table.edit")}
          </Link>
        </Button>
      </div>
    ),
  },
];
