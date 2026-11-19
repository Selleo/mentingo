import { SUPER_ADMIN_TENANT_QUERY_KEY } from "~/api/queries/super-admin/useTenant";
import { SUPER_ADMIN_TENANTS_QUERY_KEY } from "~/api/queries/super-admin/useTenants";
import { queryClient } from "~/api/queryClient";

/** Organization lists and details show user counts against the user limit. */
export async function invalidateTenantUserCountQueries() {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: SUPER_ADMIN_TENANTS_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: SUPER_ADMIN_TENANT_QUERY_KEY }),
  ]);
}
