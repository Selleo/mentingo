import type { UUIDType } from "src/common";

export function prefixTenantStorageKey(key: string, tenantId?: UUIDType) {
  if (!tenantId) return key;

  return `${tenantId}/${key.replace(/^\/+/, "")}`;
}
