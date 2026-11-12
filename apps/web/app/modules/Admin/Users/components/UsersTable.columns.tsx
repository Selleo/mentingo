import { format } from "date-fns";

import { createSelectColumn, type RowRangeSelection } from "~/components/DataTable";
import SortButton from "~/components/TableSortButton/TableSortButton";
import { Badge } from "~/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { getRoleLabel } from "~/modules/Admin/Users/utils/getRoleLabel";

import { USERS_PAGE_HANDLES } from "../../../../../e2e/data/users/handles";

import type { ColumnDef } from "@tanstack/react-table";
import type { TFunction } from "i18next";
import type { ReactNode } from "react";
import type { GetUsersResponse } from "~/api/generated-api";
import type { RoleOption } from "~/api/queries/admin/useRoles";

export type UsersTableUser = GetUsersResponse["data"][number] & { roleSlugs?: string[] };

type UsersTableColumnsOptions = {
  t: TFunction;
  roles: RoleOption[];
  rowRangeSelection: RowRangeSelection;
};

type BadgeListProps = {
  labels: { id: string; label: string }[];
  visibleCount: number;
};

const BadgeList = ({ labels, visibleCount }: BadgeListProps) => {
  const visibleLabels = labels.slice(0, visibleCount);
  const hiddenLabels = labels.slice(visibleCount);

  return (
    <div className="flex gap-1">
      {visibleLabels.map(({ id, label }) => (
        <Badge key={id} variant="secondary">
          {label}
        </Badge>
      ))}
      {hiddenLabels.length > 0 && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <Badge variant="default" className="cursor-help">
                +{hiddenLabels.length}
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="rounded-lg p-2">
              <div className="flex flex-col gap-1 !px-0">
                {hiddenLabels.map(({ id, label }) => (
                  <Badge key={id} variant="secondary">
                    {label}
                  </Badge>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
};

const sortableHeader =
  (label: string, testId: string): ColumnDef<UsersTableUser>["header"] =>
  ({ column }): ReactNode => (
    <SortButton<UsersTableUser> testId={testId} column={column}>
      {label}
    </SortButton>
  );

export const getUsersTableColumns = ({
  t,
  roles,
  rowRangeSelection,
}: UsersTableColumnsOptions): ColumnDef<UsersTableUser>[] => [
  createSelectColumn<UsersTableUser>({
    rowRangeSelection,
    getCheckboxTestId: (user) => USERS_PAGE_HANDLES.rowCheckbox(user.id),
    selectAllTestId: USERS_PAGE_HANDLES.SELECT_ALL_CHECKBOX,
    selectAllLabel: t("common.dataTable.selectAll"),
    selectRowLabel: t("common.dataTable.selectRow"),
  }),
  {
    accessorKey: "firstName",
    header: sortableHeader(t("adminUsersView.field.firstName"), USERS_PAGE_HANDLES.SORT_FIRST_NAME),
  },
  {
    accessorKey: "lastName",
    header: sortableHeader(t("adminUsersView.field.lastName"), USERS_PAGE_HANDLES.SORT_LAST_NAME),
  },
  {
    accessorKey: "email",
    header: sortableHeader(t("adminUsersView.field.email"), USERS_PAGE_HANDLES.SORT_EMAIL),
  },
  {
    accessorKey: "roleSlugs",
    header: t("adminUsersView.dropdown.roles"),
    enableSorting: false,
    cell: ({ row }) => {
      const roleSlugs = row.original.roleSlugs ?? [];
      if (!roleSlugs.length) return "-";

      return (
        <BadgeList
          labels={roleSlugs.map((roleSlug) => ({
            id: roleSlug,
            label: getRoleLabel(roleSlug, t, roles),
          }))}
          visibleCount={2}
        />
      );
    },
  },
  {
    accessorKey: "groups",
    header: t("adminUsersView.field.group"),
    enableSorting: false,
    cell: ({ row }) => (
      <BadgeList
        labels={row.original.groups.map(({ id, name }) => ({ id, label: name }))}
        visibleCount={1}
      />
    ),
  },
  {
    accessorKey: "archived",
    header: t("adminUsersView.field.status"),
    enableSorting: false,
    cell: ({ row }) => {
      const isArchived = row.original.archived;

      return (
        <Badge variant={isArchived ? "outline" : "secondary"} className="w-max">
          {isArchived ? t("common.other.archived") : t("common.other.active")}
        </Badge>
      );
    },
  },
  {
    accessorKey: "createdAt",
    header: sortableHeader(t("adminUsersView.field.createdAt"), USERS_PAGE_HANDLES.SORT_CREATED_AT),
    cell: ({ row }) => (
      <span className="whitespace-nowrap">
        {row.original.createdAt && format(new Date(row.original.createdAt), "PPpp")}
      </span>
    ),
  },
];
