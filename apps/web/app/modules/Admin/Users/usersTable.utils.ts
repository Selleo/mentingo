import { USER_STATUS_FILTERS, type UserStatusFilter } from "./usersTable.constants";

export const isUserStatusFilter = (value: string | undefined): value is UserStatusFilter =>
  Object.values(USER_STATUS_FILTERS).some((statusFilter) => statusFilter === value);
