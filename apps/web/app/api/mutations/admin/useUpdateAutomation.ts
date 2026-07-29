import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { AUTOMATIONS_QUERY_KEY } from "~/api/queries/admin/useAutomations";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type {
  AutomationStepBulkItem,
  UpdateAutomationBody,
} from "~/api/queries/admin/automation.types";

interface UpdateAutomationInput {
  automationId: string;
  body: UpdateAutomationBody;
  steps?: AutomationStepBulkItem[];
}

export function useUpdateAutomation() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ automationId, body, steps }: UpdateAutomationInput) => {
      const { data } = await ApiClient.instance.patch<{ data: unknown }>(
        `/api/automations/${automationId}`,
        body,
      );

      if (steps && steps.length > 0) {
        await ApiClient.instance.put(`/api/automation-steps/${automationId}/steps`, steps);
      }

      await queryClient.invalidateQueries({ queryKey: [AUTOMATIONS_QUERY_KEY] });
      return data.data;
    },

    onSuccess: () => {
      toast({
        variant: "default",
        description: t("automationView.toasts.updated"),
      });
    },

    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("automationView.toasts.updateError")),
      });
    },
  });
}
