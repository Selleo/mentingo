/** Empty means no user limit. */
export function toMaxUsers(maxUsers: string | undefined) {
  return maxUsers ? Number(maxUsers) : null;
}

export function toMaxUsersOverflowPercentage(maxUsersOverflowPercentage: string | undefined) {
  return maxUsersOverflowPercentage ? Number(maxUsersOverflowPercentage) : 0;
}

export function toUserCapacityFormValue(value: number | null) {
  return value === null ? "" : String(value);
}
