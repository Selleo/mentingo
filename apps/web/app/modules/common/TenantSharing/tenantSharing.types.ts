import type { MasterCourseExportSyncStatus } from "@repo/shared";

export type SharingTenant = {
  id: string;
  name: string;
  host: string;
  isExported: boolean;
  syncStatus: MasterCourseExportSyncStatus | null;
};
