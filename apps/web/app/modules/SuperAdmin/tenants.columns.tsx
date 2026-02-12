import { Link } from "@remix-run/react";

import { Button } from "~/components/ui/button";

import type { ColumnDef } from "@tanstack/react-table";
import type i18next from "i18next";
import type { FindTenantByIdResponse } from "~/api/generated-api";

export type Tenant = FindTenantByIdResponse["data"];

export const getTenantsColumns = (t: typeof i18next.t): ColumnDef<Tenant>[] => [
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
    header: () => <div className="text-right">{t("superAdminTenantsView.table.actions")}</div>,
    cell: ({ row }) => (
      <div className="text-right">
        <Button asChild variant="outline" size="sm">
          <Link to={`/super-admin/tenants/${row.original.id}`}>
            {t("superAdminTenantsView.table.edit")}
          </Link>
        </Button>
      </div>
    ),
  },
];
