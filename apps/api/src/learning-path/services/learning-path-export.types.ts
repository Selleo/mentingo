import type { UUIDType } from "src/common";

export type ExportQueueItem = {
  targetTenantId: UUIDType;
  queued: boolean;
  reason?: string;
  exportId?: UUIDType;
};
