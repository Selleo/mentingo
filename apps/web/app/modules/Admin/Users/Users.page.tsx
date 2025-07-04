import { Link, useNavigate } from "@remix-run/react";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { isEmpty } from "lodash-es";
import { Trash } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";

import { useBulkDeleteUsers } from "~/api/mutations/admin/useBulkDeleteUsers";
import { useAllUsersSuspense, usersQueryOptions } from "~/api/queries/useUsers";
import { queryClient } from "~/api/queryClient";
import SortButton from "~/components/TableSortButton/TableSortButton";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { USER_ROLE } from "~/config/userRoles";
import { cn } from "~/lib/utils";
import {
  type FilterConfig,
  type FilterValue,
  SearchFilter,
} from "~/modules/common/SearchFilter/SearchFilter";

import type { GetUsersResponse } from "~/api/generated-api";
import type { UserRole } from "~/config/userRoles";

type TUser = GetUsersResponse["data"][number];

export const clientLoader = async () => {
  queryClient.prefetchQuery(usersQueryOptions());
  return null;
};

const Users = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = React.useState<{
    keyword?: string;
    role?: UserRole;
    archived?: boolean;
    status?: string;
  }>({});
  const [isPending, startTransition] = React.useTransition();

  const { data } = useAllUsersSuspense(searchParams);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const { mutateAsync: deleteUsers } = useBulkDeleteUsers();
  const { t } = useTranslation();

  const filterConfig: FilterConfig[] = [
    {
      name: "keyword",
      type: "text",
      placeholder: t("adminUsersView.filters.placeholder.searchByKeyword"),
    },
    {
      name: "role",
      type: "select",
      placeholder: t("adminUsersView.filters.placeholder.roles"),
      options: [
        { value: USER_ROLE.admin, label: t("common.roles.admin") },
        { value: USER_ROLE.student, label: t("common.roles.student") },
        { value: USER_ROLE.contentCreator, label: t("common.roles.contentCreator") },
      ],
    },
    {
      name: "archived",
      type: "status",
    },
  ];

  const handleFilterChange = (name: string, value: FilterValue) => {
    startTransition(() => {
      setSearchParams((prev) => ({
        ...prev,
        [name]: value,
      }));
    });
  };

  const columns: ColumnDef<TUser>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label="Select all"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => row.toggleSelected(!!value)}
          aria-label="Select row"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      enableSorting: false,
    },
    {
      accessorKey: "firstName",
      header: ({ column }) => (
        <SortButton<TUser> column={column}>{t("adminUsersView.field.firstName")}</SortButton>
      ),
    },
    {
      accessorKey: "lastName",
      header: ({ column }) => (
        <SortButton<TUser> column={column}>{t("adminUsersView.field.lastName")}</SortButton>
      ),
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <SortButton<TUser> column={column}>{t("adminUsersView.field.email")}</SortButton>
      ),
    },
    {
      accessorKey: "role",
      header: t("adminUsersView.field.role"),
      cell: ({ row }) => t(`common.roles.${row.original.role}`),
    },
    {
      accessorKey: "archived",
      header: t("adminUsersView.field.status"),
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
      header: ({ column }) => (
        <SortButton<TUser> column={column}>{t("adminUsersView.field.createdAt")}</SortButton>
      ),
      cell: ({ row }) => row.original.createdAt && format(new Date(row.original.createdAt), "PPpp"),
    },
  ];

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: setSorting,
    getSortedRowModel: getSortedRowModel(),
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      rowSelection,
    },
  });

  const selectedUsers = table.getSelectedRowModel().rows.map((row) => row.original.id);

  const handleDeleteUsers = () => {
    deleteUsers({ data: { userIds: selectedUsers } }).then(() => {
      table.resetRowSelection();
      queryClient.invalidateQueries({ queryKey: ["users"] });
    });
  };

  const handleRowClick = (userId: string) => {
    navigate(userId);
  };

  return (
    <div className="flex flex-col">
      <h4 className={"text-2xl font-bold"}>{t("navigationSideBar.users")}</h4>
      <div className="flex items-center justify-between gap-2">
        <Link to="new">
          <Button variant="outline">{t("adminUsersView.button.createNew")}</Button>
        </Link>
        <SearchFilter
          filters={filterConfig}
          values={searchParams}
          onChange={handleFilterChange}
          isLoading={isPending}
        />
        <div className="ml-auto flex items-center gap-x-2 px-4 py-2">
          <p
            className={cn("text-sm", {
              "text-neutral-900": !isEmpty(selectedUsers),
              "text-neutral-500": isEmpty(selectedUsers),
            })}
          >
            {t("common.other.selected")} ({selectedUsers.length})
          </p>
          <Button
            onClick={handleDeleteUsers}
            size="sm"
            className="flex items-center gap-x-2"
            disabled={isEmpty(selectedUsers)}
          >
            <Trash className="h-3 w-3" />
            <span className="text-xs">{t("adminUsersView.button.deleteSelected")}</span>
          </Button>
        </div>
      </div>
      <Table className="border bg-neutral-50">
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              data-state={row.getIsSelected() && "selected"}
              onClick={() => handleRowClick(row.original.id)}
              className="cursor-pointer hover:bg-neutral-100"
            >
              {row.getVisibleCells().map((cell, index) => (
                <TableCell key={cell.id} className={cn({ "!w-12": index === 0 })}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};

export default Users;
