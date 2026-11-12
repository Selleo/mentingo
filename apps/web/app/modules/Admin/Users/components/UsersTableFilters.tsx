import { useTranslation } from "react-i18next";

import { type ActiveTableFilter, DataTableToolbar } from "~/components/DataTable";
import { OptionPicker } from "~/components/OptionPicker/OptionPicker";

import { USERS_PAGE_HANDLES } from "../../../../../e2e/data/users/handles";
import { USER_STATUS_FILTERS, USERS_TABLE_ANY_FILTER_VALUE } from "../usersTable.constants";
import { isUserStatusFilter } from "../usersTable.utils";

import type { UsersTableFilters as UsersTableFiltersModel } from "../hooks/useUsersTableFilters";

type FilterOption = { id: string; label: string };

type UsersTableFiltersProps = {
  filters: UsersTableFiltersModel;
  roleOptions: FilterOption[];
  groupOptions: FilterOption[];
};

const ANY_OPTION_TEST_ID_VALUE = "all";

export function UsersTableFilters({ filters, roleOptions, groupOptions }: UsersTableFiltersProps) {
  const { t } = useTranslation();

  const rolePickerOptions = [
    { id: USERS_TABLE_ANY_FILTER_VALUE, label: t("adminUsersView.filters.placeholder.roles") },
    ...roleOptions,
  ];

  const statusOptions = [
    { id: USER_STATUS_FILTERS.ACTIVE, label: t("common.other.active") },
    { id: USER_STATUS_FILTERS.ARCHIVED, label: t("common.other.archived") },
    { id: USER_STATUS_FILTERS.ALL, label: t("common.other.all") },
  ];

  const getOptionLabel = (options: FilterOption[], optionId: string) =>
    options.find(({ id }) => id === optionId)?.label ?? optionId;

  const selectedGroupsLabel = filters.groupIds
    .map((groupId) => getOptionLabel(groupOptions, groupId))
    .join(", ");

  const activeFilters: ActiveTableFilter[] = [
    ...(filters.role
      ? [
          {
            id: "role",
            label: t("adminUsersView.field.role"),
            value: getOptionLabel(roleOptions, filters.role),
            onRemove: () => filters.setRole(undefined),
          },
        ]
      : []),
    ...(filters.status !== USER_STATUS_FILTERS.ACTIVE
      ? [
          {
            id: "status",
            label: t("adminUsersView.field.status"),
            value: getOptionLabel(statusOptions, filters.status),
            onRemove: () => filters.setStatus(USER_STATUS_FILTERS.ACTIVE),
          },
        ]
      : []),
    ...filters.groupIds.map((groupId) => ({
      id: `group-${groupId}`,
      label: t("adminUsersView.field.group"),
      value: getOptionLabel(groupOptions, groupId),
      onRemove: () => filters.removeGroup(groupId),
    })),
  ];

  return (
    <DataTableToolbar
      searchValue={filters.searchInput}
      onSearchChange={filters.setSearchInput}
      searchPlaceholder={t("adminUsersView.filters.placeholder.searchByKeyword")}
      searchTestId={USERS_PAGE_HANDLES.SEARCH_INPUT}
      activeFilters={activeFilters}
      canResetFilters={filters.activeFilterCount > 0}
      onResetFilters={filters.resetFilters}
      resetTestId={USERS_PAGE_HANDLES.CLEAR_FILTERS_BUTTON}
      getActiveFilterTestId={USERS_PAGE_HANDLES.activeFilterPill}
      getRemoveFilterTestId={USERS_PAGE_HANDLES.removeFilterButton}
    >
      <OptionPicker
        label={t("adminUsersView.field.role")}
        placeholder={t("adminUsersView.filters.placeholder.roles")}
        className="w-full sm:w-48"
        options={rolePickerOptions}
        selectedIds={[filters.role ?? USERS_TABLE_ANY_FILTER_VALUE]}
        testId={USERS_PAGE_HANDLES.ROLE_FILTER}
        optionTestId={({ id }) =>
          USERS_PAGE_HANDLES.roleFilterOption(
            id === USERS_TABLE_ANY_FILTER_VALUE ? ANY_OPTION_TEST_ID_VALUE : id,
          )
        }
        onToggle={({ id }) => filters.setRole(id === USERS_TABLE_ANY_FILTER_VALUE ? undefined : id)}
      />

      <OptionPicker
        label={t("adminUsersView.field.status")}
        placeholder={t("common.other.active")}
        className="w-full sm:w-40"
        options={statusOptions}
        selectedIds={[filters.status]}
        testId={USERS_PAGE_HANDLES.STATUS_FILTER}
        optionTestId={({ id }) =>
          USERS_PAGE_HANDLES.statusFilterOption(
            isUserStatusFilter(id) ? id : USER_STATUS_FILTERS.ACTIVE,
          )
        }
        onToggle={({ id }) => {
          if (isUserStatusFilter(id)) filters.setStatus(id);
        }}
      />

      <OptionPicker
        label={t("adminUsersView.field.group")}
        placeholder={t("adminUsersView.filters.placeholder.groups")}
        selectedLabel={selectedGroupsLabel || undefined}
        className="w-full sm:w-52"
        options={groupOptions}
        selectedIds={filters.groupIds}
        multiple
        testId={USERS_PAGE_HANDLES.GROUPS_FILTER}
        optionTestId={({ id }) => USERS_PAGE_HANDLES.groupFilterOption(id)}
        onToggle={({ id }) => filters.toggleGroup(id)}
      />
    </DataTableToolbar>
  );
}
