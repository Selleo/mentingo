import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { AUTOMATIONS_QUERY_KEY } from "~/api/queries/admin/useAutomations";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { CreateAutomationBody } from "~/api/queries/admin/automation.types";

/**
 * Creates a new automation (initially in draft status).
 *
 * Backend endpoint: POST /api/automations
 * Body: { name: LocalizedText, description?: LocalizedText, status: "draft" }
 */
export function useCreateAutomation() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (body: CreateAutomationBody) => {
      const response = await ApiClient.api.automationsControllerCreateAutomation(body);
      await queryClient.invalidateQueries({ queryKey: [AUTOMATIONS_QUERY_KEY] });
      return response.data.data;
    },

    onSuccess: () => {
      toast({
        variant: "default",
        description: t("automationView.toasts.created"),
      });
    },

    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("automationView.toasts.createError")),
      });
    },
  });
}
