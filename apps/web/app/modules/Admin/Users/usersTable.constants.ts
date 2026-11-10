export const USERS_TABLE_FILTER_PARAMS = {
  KEYWORD: "keyword",
  ROLE: "role",
  STATUS: "status",
  GROUPS: "groups",
} as const;

export const USER_STATUS_FILTERS = {
  ACTIVE: "active",
  ARCHIVED: "archived",
  ALL: "all",
} as const;

export type UserStatusFilter = (typeof USER_STATUS_FILTERS)[keyof typeof USER_STATUS_FILTERS];

export const USERS_TABLE_ANY_FILTER_VALUE = "__all__";

/** Group ids are joined into one URL param. */
export const USERS_TABLE_GROUPS_SEPARATOR = ",";

/** Table columns sortable on the server, mapped to the API sort field they order by. */
export const USERS_TABLE_SORT_FIELDS = {
  firstName: "firstName",
  lastName: "lastName",
  email: "email",
  createdAt: "createdAt",
} as const;

export const USERS_TABLE_DEFAULT_PAGE_SIZE = 10;
