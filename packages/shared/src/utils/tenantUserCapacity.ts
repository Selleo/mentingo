/** Users a tenant may have: the maximum plus its overflow percentage, rounded down (200 + 10% = 220). */
export const calculateTenantAllowedUsersCount = (
  maxUsers: number,
  maxUsersOverflowPercentage: number,
): number => Math.floor((maxUsers * (100 + maxUsersOverflowPercentage)) / 100);
