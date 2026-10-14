import { MASTER_COURSE_EXPORT_SYNC_STATUSES } from "@repo/shared";

import { Checkbox } from "~/components/ui/checkbox";

import { TenantSharingStatusBadge } from "./TenantSharingStatusBadge";

import type { SharingTenant } from "./tenantSharing.types";
import type { MasterCourseExportSyncStatus } from "@repo/shared";
import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";

export const TENANT_SHARING_COLUMN_IDS = {
  SELECT: "select",
  ORGANIZATION: "organization",
  STATUS: "status",
} as const;

const SHAREABLE_SYNC_STATUSES: ReadonlyArray<MasterCourseExportSyncStatus | null> = [
  null,
  MASTER_COURSE_EXPORT_SYNC_STATUSES.ACTIVE,
  MASTER_COURSE_EXPORT_SYNC_STATUSES.FAILED,
];

/** A tenant can receive a new share only when nothing is shared, in flight, or paused. */
export const canShareWithTenant = (tenant: SharingTenant) =>
  !tenant.isExported && SHAREABLE_SYNC_STATUSES.includes(tenant.syncStatus);

export const getTenantSharingColumns = (t: TFunction): ColumnDef<SharingTenant>[] => [
  {
    id: TENANT_SHARING_COLUMN_IDS.SELECT,
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked === true)}
        disabled={!table.getRowModel().rows.some((row) => row.getCanSelect())}
        aria-label={t("tenantSharing.selectAllOnPage")}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onCheckedChange={(checked) => row.toggleSelected(checked === true)}
        onClick={(event) => event.stopPropagation()}
        aria-label={t("tenantSharing.selectOrganization", { name: row.original.name })}
      />
    ),
  },
  {
    id: TENANT_SHARING_COLUMN_IDS.ORGANIZATION,
    header: () => t("tenantSharing.columns.organization"),
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col">
        <span className="body-sm-md truncate text-neutral-950">{row.original.name}</span>
        {row.original.host !== row.original.name && (
          <span className="details-md truncate text-neutral-600">{row.original.host}</span>
        )}
      </div>
    ),
  },
  {
    id: TENANT_SHARING_COLUMN_IDS.STATUS,
    header: () => t("tenantSharing.columns.status"),
    cell: ({ row }) => <TenantSharingStatusBadge tenant={row.original} />,
  },
];
