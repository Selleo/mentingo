import { AUDIT_TYPES, type AuditType } from "@repo/shared";
import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export const latestAuditQueryKey = (type: AuditType) => ["audit", type, "latest"] as const;

export function useLatestAudit(type: AuditType) {
  return useQuery({
    queryKey: latestAuditQueryKey(type),
    queryFn: async () => {
      const response =
        type === AUDIT_TYPES.INDIVIDUAL
          ? await ApiClient.api.auditControllerGetLatestIndividual()
          : await ApiClient.api.auditControllerGetLatestSchool();
      return response.data.data;
    },
  });
}
