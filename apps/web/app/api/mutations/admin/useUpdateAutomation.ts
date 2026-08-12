import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
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
  showSuccessToast?: boolean;
}

export function useUpdateAutomation() {
  const { toast } = useToast();
  const { t } = useTranslation();
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());

  return useMutation({
    mutationFn: (input: UpdateAutomationInput) => {
      const request = queueRef.current.then(async () => {
        if (input.steps !== undefined) {
          const response = await ApiClient.api.automationsControllerSaveAutomation(
            input.automationId,
            {
              metadata: input.body,
              steps: input.steps,
            },
          );

          await queryClient.invalidateQueries({ queryKey: [AUTOMATIONS_QUERY_KEY] });
          return response.data.data;
        }

        const response = await ApiClient.api.automationsControllerUpdateAutomation(
          input.automationId,
          input.body,
        );

        await queryClient.invalidateQueries({ queryKey: [AUTOMATIONS_QUERY_KEY] });
        return response.data.data;
      });

      queueRef.current = request.catch(() => undefined);
      return request;
    },

    onSuccess: (_, variables) => {
      if (variables.showSuccessToast === false) return;

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
