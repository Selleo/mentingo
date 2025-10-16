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
import { camelCase } from "lodash-es";
import React from "react";
import { useTranslation } from "react-i18next";

import { useBulkArchiveUsers } from "~/api/mutations/admin/useBulkArchiveUsers";
import { useBulkDeleteUsers } from "~/api/mutations/admin/useBulkDeleteUsers";
import { useBulkUpdateUsersGroups } from "~/api/mutations/admin/useBulkUpdateUsersGroups";
import { useGroupsQuerySuspense } from "~/api/queries/admin/useGroups";
import { useAllUsersSuspense, usersQueryOptions } from "~/api/queries/useUsers";
import { queryClient } from "~/api/queryClient";
import { PageWrapper } from "~/components/PageWrapper";
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
import { type DropdownItems, EditDropdown } from "~/modules/Admin/Users/components/EditDropdown";
import { EditModal } from "~/modules/Admin/Users/components/EditModal";
import {
  type FilterConfig,
  type FilterValue,
  SearchFilter,
} from "~/modules/common/SearchFilter/SearchFilter";
import { USER_ROLES } from "~/utils/userRoles";

import { ImportUsersModal } from "./components/ImportUsersModal/ImportUsersModal";

import type { GetUsersResponse } from "~/api/generated-api";
import type { UserRole } from "~/config/userRoles";

type TUser = GetUsersResponse["data"][number];

type ModalTypes = "group" | "role" | "delete" | "archive" | null;

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
    groupId?: string;
  }>({ archived: false });
  const [isPending, startTransition] = React.useTransition();

  const { data } = useAllUsersSuspense(searchParams);
  const { data: groupData } = useGroupsQuerySuspense();
  const groups = groupData.map(({ id, name }) => ({ groupId: id, groupName: name }));

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [selectedValue, setSelectedValue] = React.useState<string>("");

  const { mutateAsync: deleteUsers } = useBulkDeleteUsers();
  const { mutateAsync: updateUsersGroups } = useBulkUpdateUsersGroups();
  const { mutateAsync: archiveUsers } = useBulkArchiveUsers();

  const { t } = useTranslation();

  const [showEditModal, setShowEditModal] = React.useState<ModalTypes>(null);
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);

  const dropdownItems: DropdownItems[] = [
    {
      icon: "ArrowUpDown",
      translationKey: "adminUsersView.dropdown.changeRole",
      action: () => setShowEditModal("role"),
      destructive: false,
    },
    {
      icon: "ArrowUpDown",
      translationKey: "adminUsersView.dropdown.changeGroup",
      action: () => setShowEditModal("group"),
      destructive: false,
    },
    {
      icon: "Archive",
      translationKey: "adminUsersView.dropdown.archive",
      action: () => setShowEditModal("archive"),
      destructive: true,
    },
    {
      icon: "TrashIcon",
      translationKey: "adminUsersView.dropdown.delete",
      action: () => setShowEditModal("delete"),
      destructive: true,
    },
  ];

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
    {
      name: "groupId",
      type: "select",
      placeholder: t("adminUsersView.filters.placeholder.groups"),
      options:
        groupData.map((item) => ({
          value: item.id,
          label: item.name,
        })) ?? [],
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
          data-testid={row.original.email}
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
      cell: ({ row }) => t(`common.roles.${camelCase(row.original.role)}`),
    },
    {
      accessorKey: "groupName",
      header: ({ column }) => (
        <SortButton column={column}>{t("adminUsersView.field.group")}</SortButton>
      ),
      cell: ({ row }) => row.original.groupName,
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
    getRowId: (row) => row.id,
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

  const handleArchiveUsers = () => {
    archiveUsers({ data: { userIds: selectedUsers }, searchParams }).then(() => {
      table.resetRowSelection();
      setShowEditModal(null);
    });
  };

  const handleUsersGroups = () => {
    updateUsersGroups({
      data: {
        userIds: selectedUsers,
        groupId: selectedValue,
      },
    }).then(() => {
      table.resetRowSelection();
      setShowEditModal(null);
    });
  };

  const handleRowClick = (userId: string) => {
    navigate(userId);
  };

  const editMutation = {
    role: () => {},
    group: handleUsersGroups,
    delete: handleDeleteUsers,
    archive: handleArchiveUsers,
  };

  return (
    <PageWrapper
      breadcrumbs={[
        {
          title: t("adminUsersView.breadcrumbs.dashboard"),
          href: "/",
        },
        {
          title: t("adminUsersView.breadcrumbs.users"),
          href: "/admin/users",
        },
      ]}
    >
      <div className="flex flex-col">
        {showEditModal && (
          <EditModal
            type={showEditModal}
            onConfirm={editMutation[showEditModal]}
            onCancel={() => setShowEditModal(null)}
            groupData={groups}
            roleData={Object.values(USER_ROLES)}
            selectedUsers={selectedUsers.length}
            selectedValue={selectedValue}
            setSelectedValue={setSelectedValue}
          />
        )}
        {isImportModalOpen && (
          <ImportUsersModal
            open={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            searchParams={searchParams}
          />
        )}
        <div className="flex flex-wrap justify-between gap-3">
          <h4 className="text-2xl font-bold">{t("navigationSideBar.users")}</h4>
          <div className="flex gap-3">
            <Button variant="primary" asChild>
              <Link to="new">{t("adminUsersView.button.createNew")}</Link>
            </Button>
            <Button onClick={() => setIsImportModalOpen(true)}>
              {t("adminUsersView.button.import")}
            </Button>
            <EditDropdown dropdownItems={dropdownItems} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <SearchFilter
            filters={filterConfig}
            values={searchParams}
            onChange={handleFilterChange}
            isLoading={isPending}
          />
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
    </PageWrapper>
  );
};

export default Users;
