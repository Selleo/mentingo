import { AUDIT_TYPES, type AuditAnswer, type AuditType } from "@repo/shared";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { auditBenchmarkQueryKey } from "../queries/useAuditBenchmark";
import { auditHistoryQueryKey } from "../queries/useAuditHistory";
import { latestAuditQueryKey } from "../queries/useLatestAudit";
import { queryClient } from "../queryClient";

type SubmitAuditInput = {
  definitionVersion: number;
  answers: AuditAnswer[];
};

export function useSubmitAudit(type: AuditType) {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: SubmitAuditInput) => {
      const response =
        type === AUDIT_TYPES.INDIVIDUAL
          ? await ApiClient.api.auditControllerSubmitIndividual(input)
          : await ApiClient.api.auditControllerSubmitSchool(input);
      return response.data.data;
    },
    onSuccess: async () => {
      const invalidations = [
        queryClient.invalidateQueries({ queryKey: latestAuditQueryKey(type) }),
        queryClient.invalidateQueries({ queryKey: auditHistoryQueryKey(type) }),
      ];
      if (type === AUDIT_TYPES.SCHOOL) {
        invalidations.push(queryClient.invalidateQueries({ queryKey: auditBenchmarkQueryKey }));
      }
      await Promise.all(invalidations);
      toast({ description: t("auditView.toast.saved") });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("auditView.toast.saveError")),
      });
    },
  });
}
