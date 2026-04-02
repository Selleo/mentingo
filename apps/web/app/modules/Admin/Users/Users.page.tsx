import { Link, useNavigate, type MetaFunction } from "@remix-run/react";
import { PERMISSIONS, SYSTEM_ROLE_PERMISSIONS } from "@repo/shared";
import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  type RowSelectionState,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { format } from "date-fns";
import { Import, KeyRound, Plus, Shield, UsersRound } from "lucide-react";
import React, { useCallback, useMemo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { useBulkArchiveUsers } from "~/api/mutations/admin/useBulkArchiveUsers";
import { useBulkDeleteUsers } from "~/api/mutations/admin/useBulkDeleteUsers";
import { useBulkUpdateUsersGroups } from "~/api/mutations/admin/useBulkUpdateUsersGroups";
import { useBulkUpdateUsersRoles } from "~/api/mutations/admin/useBulkUpdateUsersRoles";
import { useGroupsQuerySuspense } from "~/api/queries/admin/useGroups";
import { useRoles } from "~/api/queries/admin/useRoles";
import { useAllUsersSuspense, usersQueryOptions } from "~/api/queries/useUsers";
import { queryClient } from "~/api/queryClient";
import { PageWrapper } from "~/components/PageWrapper";
import { Pagination } from "~/components/Pagination/Pagination";
import SortButton from "~/components/TableSortButton/TableSortButton";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "~/components/ui/tooltip";
import { cn } from "~/lib/utils";
import { type DropdownItems, EditDropdown } from "~/modules/Admin/Users/components/EditDropdown";
import { EditModal } from "~/modules/Admin/Users/components/EditModal";
import { PermissionsMatrix } from "~/modules/Admin/Users/components/PermissionsMatrix";
import { getRoleLabel } from "~/modules/Admin/Users/utils/getRoleLabel";
import {
  type FilterConfig,
  type FilterValue,
  SearchFilter,
} from "~/modules/common/SearchFilter/SearchFilter";
import { setPageTitle } from "~/utils/setPageTitle";
import { handleRowSelectionRange } from "~/utils/tableRangeSelection";
import { tanstackSortingToParam } from "~/utils/tanstackSortingToParam";

import { ImportUsersModal } from "./components/ImportUsersModal/ImportUsersModal";

import type { PermissionKey } from "@repo/shared";
import type { BulkAssignUsersToGroupBody, GetUsersResponse } from "~/api/generated-api";
import type { UsersParams } from "~/api/queries/useUsers";
import type { ITEMS_PER_PAGE_OPTIONS } from "~/components/Pagination/Pagination";
import type { Option } from "~/components/ui/multiselect";

type TUser = GetUsersResponse["data"][number];

type ModalTypes = "group" | "role" | "delete" | "archive" | null;

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.users");

export const clientLoader = async () => {
  queryClient.prefetchQuery(usersQueryOptions());
  return null;
};

const Users = () => {
  const navigate = useNavigate();

  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});

  const [searchParams, setSearchParams] = React.useState<{
    keyword?: string;
    role?: string;
    archived?: boolean;
    status?: string;
    groups?: Option[];
  }>({ archived: false });

  const usersQueryParams = useMemo(() => {
    const sort = tanstackSortingToParam(sorting) as UsersParams["sort"];
    return { ...searchParams, sort };
  }, [searchParams, sorting]);

  const [isPending, startTransition] = React.useTransition();

  const { data: userData } = useAllUsersSuspense(usersQueryParams);
  const { data: groupData } = useGroupsQuerySuspense();
  const { data: roles = [] } = useRoles();

  const [selectedValue, setSelectedValue] = React.useState<string[]>([]);

  const { mutateAsync: deleteUsers } = useBulkDeleteUsers();
  const { mutateAsync: updateUsersGroups } = useBulkUpdateUsersGroups();
  const { mutateAsync: archiveUsers } = useBulkArchiveUsers();
  const { mutateAsync: updateUsersRoles } = useBulkUpdateUsersRoles();

  const { t } = useTranslation();

  const [showEditModal, setShowEditModal] = React.useState<ModalTypes>(null);
  const [isImportModalOpen, setIsImportModalOpen] = React.useState(false);
  const [isPermissionsMatrixOpen, setIsPermissionsMatrixOpen] = React.useState(false);

  const [lastSelectedRowIndex, setLastSelectedRowIndex] = React.useState<number>(0);

  const permissionsOrder = useMemo(() => Object.values(PERMISSIONS) as PermissionKey[], []);

  const systemRolesForMatrix = useMemo(
    () =>
      roles
        .filter((role) => role.isSystem)
        .map((role) => ({
          slug: role.slug,
          label: getRoleLabel(role.slug, t, roles),
          permissions: SYSTEM_ROLE_PERMISSIONS[role.slug] ?? [],
        })),
    [roles, t],
  );

  const dropdownItems: DropdownItems[] = [
    {
      iconName: undefined,
      icon: <KeyRound className="size-4" />,
      translationKey: "adminUsersView.dropdown.roles",
      action: () => setShowEditModal("role"),
      destructive: false,
    },
    {
      iconName: undefined,
      icon: <UsersRound className="size-4" />,
      translationKey: "adminUsersView.dropdown.groups",
      action: () => setShowEditModal("group"),
      destructive: false,
    },
    {
      iconName: "Archive",
      icon: undefined,
      translationKey: "adminUsersView.dropdown.archive",
      action: () => setShowEditModal("archive"),
      destructive: true,
    },
    {
      iconName: "TrashIcon",
      icon: undefined,
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
      options: roles.map((role) => ({
        value: role.slug,
        label: getRoleLabel(role.slug, t, roles),
      })),
    },
    {
      name: "archived",
      type: "status",
    },
    {
      name: "groups",
      type: "multiselect",
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
          aria-label="Select row"
          data-testid={row.original.email}
          onClick={(event) => {
            event.stopPropagation();
            handleRowSelectionRange({
              table,
              event,
              id: row.id,
              idx: row.index,
              value: row.getIsSelected(),
              lastSelectedRowIndex,
              setLastSelectedRowIndex,
            });
          }}
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
      accessorKey: "roleSlugs",
      header: t("adminUsersView.dropdown.roles"),
      cell: ({ row }) => {
        const roleSlugs = (row.original as TUser & { roleSlugs?: string[] }).roleSlugs ?? [];
        const visibleRoleSlugs = roleSlugs.slice(0, 2);
        const remainingCount = roleSlugs.length - visibleRoleSlugs.length;

        if (!roleSlugs.length) return "-";

        return (
          <div className="flex gap-1">
            {visibleRoleSlugs.map((roleSlug) => (
              <Badge key={roleSlug} variant="secondary">
                {getRoleLabel(roleSlug, t, roles)}
              </Badge>
            ))}
            {remainingCount > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="default" className="cursor-help">
                      +{remainingCount}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="p-2 rounded-lg">
                    <div className="flex flex-col gap-1 !px-0">
                      {roleSlugs.slice(2).map((roleSlug) => (
                        <Badge key={roleSlug} variant="secondary">
                          {getRoleLabel(roleSlug, t, roles)}
                        </Badge>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        );
      },
    },
    {
      accessorKey: "groups",
      header: t("adminUsersView.field.group"),
      cell: ({ row }) => {
        const groups = row.original.groups;
        const visibleGroups = groups.slice(0, 1);
        const remainingCount = groups.length - visibleGroups.length;

        return (
          <div className="flex gap-1">
            {visibleGroups.map((group) => (
              <Badge key={group.id} variant="secondary">
                {group.name}
              </Badge>
            ))}
            {remainingCount > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Badge variant="default" className="cursor-help">
                      +{remainingCount}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="p-2 rounded-lg">
                    <div className="flex flex-col gap-1 !px-0">
                      {groups.slice(1).map((group) => (
                        <Badge key={group.id} variant="secondary">
                          {group.name}
                        </Badge>
                      ))}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        );
      },
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

  const resetPage = useCallback(() => handleFilterChange("page", "1"), []);

  const handleSortingChange = useCallback(
    (updaterOrValue: SortingState | ((old: SortingState) => SortingState)) => {
      setSorting(updaterOrValue);
      resetPage();
    },
    [resetPage],
  );

  const table = useReactTable({
    getRowId: (row) => row.id,
    data: userData.data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    onSortingChange: handleSortingChange,
    onRowSelectionChange: setRowSelection,
    manualSorting: true,
    state: {
      sorting,
      rowSelection,
    },
  });

  const [selectedUsers, setSelectedUsers] = useState<BulkAssignUsersToGroupBody>([]);

  useEffect(() => {
    setSelectedUsers(
      table.getSelectedRowModel().rows.map((row) => ({
        userId: row.original.id,
        groups: row.original.groups.map((group) => group.id),
      })),
    );
  }, [table, rowSelection]);

  const handleDeleteUsers = useCallback(() => {
    deleteUsers({ data: { userIds: selectedUsers.map((user) => user.userId) } }).then(() => {
      table.resetRowSelection();
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowEditModal(null);
    });
  }, [deleteUsers, selectedUsers, table]);

  const handleArchiveUsers = useCallback(() => {
    archiveUsers({
      data: { userIds: selectedUsers.map((user) => user.userId) },
      searchParams,
    }).then(() => {
      table.resetRowSelection();
      setShowEditModal(null);
    });
  }, [archiveUsers, searchParams, selectedUsers, table]);

  const handleUsersGroups = useCallback(
    (payload?: BulkAssignUsersToGroupBody) => {
      const data = payload ?? selectedUsers;

      updateUsersGroups({
        data,
      }).then(() => {
        table.resetRowSelection();
        setShowEditModal(null);
      });
    },
    [selectedUsers, table, updateUsersGroups],
  );

  const handleUsersRoles = useCallback(() => {
    updateUsersRoles({
      userIds: selectedUsers.map(({ userId }) => userId),
      roleSlugs: selectedValue,
    }).then(() => {
      table.resetRowSelection();
      setShowEditModal(null);
    });
  }, [selectedUsers, selectedValue, table, updateUsersRoles]);

  const handleRowClick = (userId: string) => {
    navigate(userId);
  };

  const editMutation: Record<string, (payload?: BulkAssignUsersToGroupBody) => void> = {
    role: handleUsersRoles,
    group: handleUsersGroups,
    delete: handleDeleteUsers,
    archive: handleArchiveUsers,
  };

  const { totalItems, perPage, page } = userData?.pagination || {};

  return (
    <PageWrapper
      breadcrumbs={[
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
            groupData={groupData}
            roleData={roles}
            selectedUsers={selectedUsers}
            selectedValue={selectedValue}
            setSelectedValue={setSelectedValue}
          />
        )}
        <Dialog open={isPermissionsMatrixOpen} onOpenChange={setIsPermissionsMatrixOpen}>
          <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>{t("adminUsersView.permissionsMatrix.title")}</DialogTitle>
            </DialogHeader>
            <div className="overflow-auto">
              <PermissionsMatrix roles={systemRolesForMatrix} permissionsOrder={permissionsOrder} />
            </div>
          </DialogContent>
        </Dialog>
        {isImportModalOpen && (
          <ImportUsersModal
            open={isImportModalOpen}
            onClose={() => setIsImportModalOpen(false)}
            searchParams={searchParams}
          />
        )}
        <div className="flex flex-wrap justify-between gap-3">
          <h4 className="h4">{t("navigationSideBar.users")}</h4>
          <div className="flex gap-3">
            <Link to="new">
              <Button variant="primary" className="gap-2">
                <Plus className="size-4" />
                {t("adminUsersView.button.createNew")}
              </Button>
            </Link>
            <Button onClick={() => setIsImportModalOpen(true)} className="gap-2">
              <Import className="size-4" />
              {t("adminUsersView.button.import")}
            </Button>
            <Button
              onClick={() => setIsPermissionsMatrixOpen(true)}
              className="gap-2"
              variant="outline"
            >
              <Shield className="size-4" />
              {t("adminUsersView.button.permissionsMatrix")}
            </Button>
            <EditDropdown dropdownItems={dropdownItems} disabled={!selectedUsers.length} />
          </div>
        </div>
        <div className="flex items-center justify-between gap-2">
          <SearchFilter
            filters={filterConfig}
            values={searchParams}
            onChange={(key, value) => {
              resetPage();
              handleFilterChange(key, value);
            }}
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
        <Pagination
          className="border-b border-x bg-neutral-50 rounded-b-lg"
          emptyDataClassName="border-b border-x bg-neutral-50 rounded-b-lg"
          totalItems={totalItems}
          itemsPerPage={perPage as (typeof ITEMS_PER_PAGE_OPTIONS)[number]}
          currentPage={page}
          onPageChange={(newPage) => handleFilterChange("page", String(newPage))}
          onItemsPerPageChange={(newPerPage) => {
            resetPage();
            handleFilterChange("perPage", newPerPage);
          }}
        />
      </div>
    </PageWrapper>
  );
};

export default Users;
