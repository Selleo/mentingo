import { Link, useNavigate, type MetaFunction } from "@remix-run/react";
import { PERMISSIONS, SYSTEM_ROLE_PERMISSIONS } from "@repo/shared";
import { getCoreRowModel, type RowSelectionState, useReactTable } from "@tanstack/react-table";
import {
  Archive,
  Import,
  KeyRound,
  Mail,
  Plus,
  Shield,
  ShieldUser,
  Trash2,
  Users as UsersIcon,
} from "lucide-react";
import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useBulkArchiveUsers } from "~/api/mutations/admin/useBulkArchiveUsers";
import { useBulkDeleteUsers } from "~/api/mutations/admin/useBulkDeleteUsers";
import { useBulkSendPasswordEmails } from "~/api/mutations/admin/useBulkSendPasswordEmails";
import { useBulkUpdateUsersGroups } from "~/api/mutations/admin/useBulkUpdateUsersGroups";
import { useBulkUpdateUsersRoles } from "~/api/mutations/admin/useBulkUpdateUsersRoles";
import { useGroupsQuerySuspense } from "~/api/queries/admin/useGroups";
import { useRoles } from "~/api/queries/admin/useRoles";
import { useAllUsersSuspense } from "~/api/queries/useUsers";
import { queryClient } from "~/api/queryClient";
import {
  DataTable,
  DataTableCard,
  DataTableEmptyState,
  DataTablePagination,
  DataTableSelectionBar,
  useClampedPage,
  useRowRangeSelection,
} from "~/components/DataTable";
import { PageHeader } from "~/components/PageHeader/PageHeader";
import { PageWrapper } from "~/components/PageWrapper";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "~/components/ui/dialog";
import { cn } from "~/lib/utils";
import { type DropdownItems, EditDropdown } from "~/modules/Admin/Users/components/EditDropdown";
import { EditModal } from "~/modules/Admin/Users/components/EditModal";
import { PermissionsMatrix } from "~/modules/Admin/Users/components/PermissionsMatrix";
import { getRoleLabel } from "~/modules/Admin/Users/utils/getRoleLabel";
import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";
import { setPageTitle } from "~/utils/setPageTitle";

import { USERS_PAGE_HANDLES } from "../../../../e2e/data/users/handles";

import { ImportUsersModal } from "./components/ImportUsersModal/ImportUsersModal";
import { getUsersTableColumns } from "./components/UsersTable.columns";
import { UsersTableFilters } from "./components/UsersTableFilters";
import { useUsersTableFilters } from "./hooks/useUsersTableFilters";

import type { PermissionKey } from "@repo/shared";
import type { BulkAssignUsersToGroupBody } from "~/api/generated-api";

const MailKey = ({ className }: { className?: string }) => (
  <span className={cn("relative inline-flex size-4 shrink-0", className)}>
    <Mail className="absolute inset-0 size-4" />
    <KeyRound className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full bg-background" />
  </span>
);

type ModalTypes = "group" | "role" | "delete" | "archive" | "passwordEmail" | null;

export const meta: MetaFunction = ({ matches }) => setPageTitle(matches, "pages.users");

const Users = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);

  const filters = useUsersTableFilters();

  // Keeps the current rows on screen while users for the new filters load.
  const deferredUsersParams = useDeferredValue(filters.usersParams);
  const isRefreshingUsers = deferredUsersParams !== filters.usersParams;

  const { data: userData } = useAllUsersSuspense(deferredUsersParams);
  const { data: groupData } = useGroupsQuerySuspense({ language });
  const { data: roles = [] } = useRoles();

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const rowRangeSelection = useRowRangeSelection();
  const [selectedValue, setSelectedValue] = useState<string[]>([]);

  const { mutateAsync: deleteUsers } = useBulkDeleteUsers();
  const { mutateAsync: updateUsersGroups } = useBulkUpdateUsersGroups();
  const { mutateAsync: archiveUsers } = useBulkArchiveUsers();
  const { mutateAsync: updateUsersRoles } = useBulkUpdateUsersRoles();
  const { mutateAsync: sendPasswordEmails } = useBulkSendPasswordEmails();

  const [showEditModal, setShowEditModal] = useState<ModalTypes>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isPermissionsMatrixOpen, setIsPermissionsMatrixOpen] = useState(false);

  useEffect(() => {
    setRowSelection({});
  }, [filters.usersParams]);

  useClampedPage({
    page: filters.page,
    perPage: userData.pagination.perPage,
    totalItems: userData.pagination.totalItems,
    setPage: filters.setPage,
  });

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
      icon: <ShieldUser className="size-4 shrink-0" />,
      translationKey: "adminUsersView.dropdown.roles",
      action: () => setShowEditModal("role"),
      destructive: false,
      testId: USERS_PAGE_HANDLES.BULK_EDIT_ROLE_ACTION,
    },
    {
      icon: <UsersIcon className="size-4 shrink-0" />,
      translationKey: "adminUsersView.dropdown.groups",
      action: () => setShowEditModal("group"),
      destructive: false,
      testId: USERS_PAGE_HANDLES.BULK_EDIT_GROUP_ACTION,
    },
    {
      icon: <MailKey className="size-4 shrink-0" />,
      translationKey: "adminUsersView.dropdown.passwordEmail",
      action: () => setShowEditModal("passwordEmail"),
      destructive: false,
      testId: USERS_PAGE_HANDLES.BULK_EDIT_PASSWORD_EMAIL_ACTION,
    },
    {
      icon: <Archive className="size-4 shrink-0" />,
      translationKey: "adminUsersView.dropdown.archive",
      action: () => setShowEditModal("archive"),
      destructive: true,
      testId: USERS_PAGE_HANDLES.BULK_EDIT_ARCHIVE_ACTION,
    },
    {
      icon: <Trash2 className="size-4 shrink-0" />,
      translationKey: "adminUsersView.dropdown.delete",
      action: () => setShowEditModal("delete"),
      destructive: true,
      testId: USERS_PAGE_HANDLES.BULK_EDIT_DELETE_ACTION,
    },
  ];

  const columns = getUsersTableColumns({ t, roles, rowRangeSelection });

  const table = useReactTable({
    getRowId: (row) => row.id,
    data: userData.data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualSorting: true,
    enableMultiSort: false,
    onSortingChange: filters.setSorting,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting: filters.sorting,
      rowSelection,
    },
  });

  const selectedUsers: BulkAssignUsersToGroupBody = table.getSelectedRowModel().rows.map((row) => ({
    userId: row.original.id,
    groups: row.original.groups.map((group) => group.id),
  }));
  const selectedUserIds = selectedUsers.map(({ userId }) => userId);

  const closeModalAndClearSelection = useCallback(() => {
    setRowSelection({});
    setShowEditModal(null);
  }, []);

  const handleDeleteUsers = () => {
    deleteUsers({ data: { userIds: selectedUserIds } }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      closeModalAndClearSelection();
    });
  };

  const handleArchiveUsers = () => {
    archiveUsers({
      data: { userIds: selectedUserIds },
      searchParams: filters.usersParams,
    }).then(closeModalAndClearSelection);
  };

  const handleUsersGroups = (payload?: BulkAssignUsersToGroupBody) => {
    updateUsersGroups({ data: payload ?? selectedUsers }).then(closeModalAndClearSelection);
  };

  const handleUsersRoles = () => {
    updateUsersRoles({ userIds: selectedUserIds, roleSlugs: selectedValue }).then(
      closeModalAndClearSelection,
    );
  };

  const handlePasswordEmails = () => {
    sendPasswordEmails({ userIds: selectedUserIds }).then(closeModalAndClearSelection);
  };

  const editMutation: Record<string, (payload?: BulkAssignUsersToGroupBody) => void> = {
    role: handleUsersRoles,
    group: handleUsersGroups,
    delete: handleDeleteUsers,
    archive: handleArchiveUsers,
    passwordEmail: handlePasswordEmails,
  };

  const roleOptions = roles.map((role) => ({
    id: role.slug,
    label: getRoleLabel(role.slug, t, roles),
  }));
  const groupOptions = groupData.map((group) => ({ id: group.id, label: group.name }));

  return (
    <PageWrapper
      breadcrumbs={[
        {
          title: t("adminUsersView.breadcrumbs.users"),
          href: "/admin/users",
        },
      ]}
    >
      <div data-testid={USERS_PAGE_HANDLES.PAGE} className="flex flex-col gap-6">
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
          <DialogContent className="flex max-h-[85vh] max-w-5xl flex-col">
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
            searchParams={filters.usersParams}
          />
        )}

        <PageHeader
          title={t("navigationSideBar.users")}
          headingTestId={USERS_PAGE_HANDLES.HEADING}
          actions={
            <>
              <Button
                data-testid={USERS_PAGE_HANDLES.PERMISSIONS_MATRIX_BUTTON}
                onClick={() => setIsPermissionsMatrixOpen(true)}
                className="gap-2"
                variant="outline"
              >
                <Shield className="size-4" aria-hidden />
                {t("adminUsersView.button.permissionsMatrix")}
              </Button>
              <Button
                data-testid={USERS_PAGE_HANDLES.IMPORT_BUTTON}
                onClick={() => setIsImportModalOpen(true)}
                className="gap-2"
                variant="outline"
              >
                <Import className="size-4" aria-hidden />
                {t("adminUsersView.button.import")}
              </Button>
              <Link to="new">
                <Button
                  data-testid={USERS_PAGE_HANDLES.CREATE_BUTTON}
                  variant="primary"
                  className="gap-2"
                >
                  <Plus className="size-4" aria-hidden />
                  {t("adminUsersView.button.createNew")}
                </Button>
              </Link>
            </>
          }
        />

        <DataTableCard>
          <UsersTableFilters
            filters={filters}
            roleOptions={roleOptions}
            groupOptions={groupOptions}
          />

          <DataTableSelectionBar
            selectedCount={selectedUserIds.length}
            countTestId={USERS_PAGE_HANDLES.SELECTED_COUNT}
          >
            <EditDropdown
              dropdownItems={dropdownItems}
              disabled={!selectedUserIds.length}
              triggerTestId={USERS_PAGE_HANDLES.BULK_EDIT_TRIGGER}
            />
          </DataTableSelectionBar>

          <DataTable
            table={table}
            isRefreshing={isRefreshingUsers}
            onRowClick={(row) => navigate(row.original.id)}
            rowRangeSelection={rowRangeSelection}
            testId={USERS_PAGE_HANDLES.TABLE}
            bodyTestId={USERS_PAGE_HANDLES.TABLE_BODY}
            getRowTestId={(user) => USERS_PAGE_HANDLES.row(user.id)}
            emptyState={
              <DataTableEmptyState
                testId={USERS_PAGE_HANDLES.EMPTY_STATE}
                onResetFilters={filters.activeFilterCount > 0 ? filters.resetFilters : undefined}
              />
            }
          />

          <DataTablePagination
            totalItems={userData.pagination.totalItems}
            itemsPerPage={filters.perPage}
            currentPage={filters.page}
            onPageChange={filters.setPage}
            onItemsPerPageChange={filters.setPerPage}
            testIds={{
              previous: USERS_PAGE_HANDLES.PAGINATION_PREVIOUS,
              next: USERS_PAGE_HANDLES.PAGINATION_NEXT,
              page: USERS_PAGE_HANDLES.paginationPage,
              itemsPerPage: USERS_PAGE_HANDLES.PAGINATION_ITEMS_PER_PAGE,
            }}
          />
        </DataTableCard>
      </div>
    </PageWrapper>
  );
};

export default Users;
