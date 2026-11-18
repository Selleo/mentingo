export function withIsoAccessEndsAt<Tenant extends { accessEndsAt: string | null }>(
  tenant: Tenant,
): Tenant {
  return {
    ...tenant,
    accessEndsAt: tenant.accessEndsAt && new Date(tenant.accessEndsAt).toISOString(),
  };
}
