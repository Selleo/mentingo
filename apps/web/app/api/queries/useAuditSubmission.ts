import { AUDIT_TYPES, type AuditType } from "@repo/shared";
import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export const auditSubmissionQueryKey = (type: AuditType, id: string) =>
  ["audit", type, "submission", id] as const;

export function useAuditSubmission(type: AuditType, id: string) {
  return useQuery({
    queryKey: auditSubmissionQueryKey(type, id),
    queryFn: async () => {
      const response =
        type === AUDIT_TYPES.INDIVIDUAL
          ? await ApiClient.api.auditControllerGetIndividualSubmission(id)
          : await ApiClient.api.auditControllerGetSchoolSubmission(id);
      return response.data.data;
    },
  });
}
