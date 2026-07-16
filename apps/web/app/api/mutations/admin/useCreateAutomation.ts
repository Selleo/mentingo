import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

// import { ApiClient } from "~/api/api-client";
import { AUTOMATIONS_QUERY_KEY } from "~/api/queries/admin/useAutomations";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { CreateAutomationBody } from "~/api/queries/admin/automation.types";

/**
 * Creates a new automation (initially in Draft status).
 *
 * Backend contract (expected endpoint):
 *   POST /api/automations
 *   Body: { name: string, description?: string }
 *   Response: { data: { id: string, ...AutomationListItem } }
 */
export function useCreateAutomation() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (body: CreateAutomationBody) => {
      // TODO: Uncomment once backend is ready:
      // const { data } = await ApiClient.api.automationControllerCreate(body);
      // await queryClient.invalidateQueries({ queryKey: [AUTOMATIONS_QUERY_KEY] });
      // return data;

      // Stub: simulate successful creation
      await queryClient.invalidateQueries({ queryKey: [AUTOMATIONS_QUERY_KEY] });
      return { data: { id: `temp-${Date.now()}`, ...body, status: "Draft" as const } };
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
