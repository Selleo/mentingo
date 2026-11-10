import { useMemo } from "react";
import { match } from "ts-pattern";

import { useUrlTableState } from "~/hooks/useUrlTableState";

import {
  USER_STATUS_FILTERS,
  USERS_TABLE_DEFAULT_PAGE_SIZE,
  USERS_TABLE_FILTER_PARAMS,
  USERS_TABLE_GROUPS_SEPARATOR,
  USERS_TABLE_SORT_FIELDS,
  type UserStatusFilter,
} from "../usersTable.constants";
import { isUserStatusFilter } from "../usersTable.utils";

import type { UsersParams } from "~/api/queries/useUsers";

const USERS_TABLE_FILTER_KEYS = [
  USERS_TABLE_FILTER_PARAMS.ROLE,
  USERS_TABLE_FILTER_PARAMS.STATUS,
  USERS_TABLE_FILTER_PARAMS.GROUPS,
] as const;

const toArchivedParam = (status: UserStatusFilter): Pick<UsersParams, "archived"> =>
  match(status)
    .with(USER_STATUS_FILTERS.ACTIVE, () => ({ archived: false }))
    .with(USER_STATUS_FILTERS.ARCHIVED, () => ({ archived: true }))
    .with(USER_STATUS_FILTERS.ALL, () => ({}))
    .exhaustive();

/** Users table state kept in the URL; an absent status filter means active users only. */
export function useUsersTableFilters() {
  const tableState = useUrlTableState({
    searchParam: USERS_TABLE_FILTER_PARAMS.KEYWORD,
    filterKeys: USERS_TABLE_FILTER_KEYS,
    sortFields: USERS_TABLE_SORT_FIELDS,
    defaultPerPage: USERS_TABLE_DEFAULT_PAGE_SIZE,
  });
  const { search: keyword, filters, sort, page, perPage } = tableState;

  const role = filters.role;
  const status = isUserStatusFilter(filters.status) ? filters.status : USER_STATUS_FILTERS.ACTIVE;
  const groupsParam = filters.groups ?? "";
  const groupIds = useMemo(
    () => groupsParam.split(USERS_TABLE_GROUPS_SEPARATOR).filter(Boolean),
    [groupsParam],
  );

  const usersParams = useMemo<UsersParams>(
    () => ({
      ...(keyword && { keyword }),
      ...(role && { role }),
      ...toArchivedParam(status),
      ...(groupIds.length && {
        groups: groupIds.map((groupId) => ({ value: groupId, label: groupId })),
      }),
      ...(sort && { sort }),
      page,
      perPage,
    }),
    [keyword, role, status, groupIds, sort, page, perPage],
  );

  const setGroupIds = (nextGroupIds: string[]) =>
    tableState.setFilter(
      USERS_TABLE_FILTER_PARAMS.GROUPS,
      nextGroupIds.join(USERS_TABLE_GROUPS_SEPARATOR),
    );

  return {
    ...tableState,
    usersParams,
    role,
    status,
    groupIds,
    setRole: (nextRole?: string) => tableState.setFilter(USERS_TABLE_FILTER_PARAMS.ROLE, nextRole),
    setStatus: (nextStatus: UserStatusFilter) =>
      tableState.setFilter(
        USERS_TABLE_FILTER_PARAMS.STATUS,
        nextStatus === USER_STATUS_FILTERS.ACTIVE ? undefined : nextStatus,
      ),
    toggleGroup: (groupId: string) =>
      setGroupIds(
        groupIds.includes(groupId)
          ? groupIds.filter((selectedGroupId) => selectedGroupId !== groupId)
          : [...groupIds, groupId],
      ),
    removeGroup: (groupId: string) =>
      setGroupIds(groupIds.filter((selectedGroupId) => selectedGroupId !== groupId)),
  };
}

export type UsersTableFilters = ReturnType<typeof useUsersTableFilters>;
