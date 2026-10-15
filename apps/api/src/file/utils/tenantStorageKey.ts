import { Value } from "@sinclair/typebox/value";

import { UUIDSchema } from "src/common";

import type { UUIDType } from "src/common";

export function prefixTenantStorageKey(key: string, tenantId?: UUIDType) {
  if (!tenantId) return key;

  return `${tenantId}/${key.replace(/^\/+/, "")}`;
}

/** Returns the tenant a storage key is namespaced under, or undefined for keys without a tenant prefix. */
export function findStorageKeyTenantId(key: string): UUIDType | undefined {
  const [firstSegment] = key.replace(/^\/+/, "").split("/");

  return Value.Check(UUIDSchema, firstSegment) ? firstSegment : undefined;
}
