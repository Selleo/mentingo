import { AUDIT_TYPES, type AuditType } from "@repo/shared";
import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export const auditHistoryQueryKey = (type: AuditType) => ["audit", type, "history"] as const;

export function useAuditHistory(type: AuditType, enabled: boolean) {
  return useQuery({
    queryKey: auditHistoryQueryKey(type),
    queryFn: async () => {
      const response =
        type === AUDIT_TYPES.INDIVIDUAL
          ? await ApiClient.api.auditControllerGetIndividualHistory()
          : await ApiClient.api.auditControllerGetSchoolHistory();
      return response.data.data;
    },
    enabled,
  });
}
