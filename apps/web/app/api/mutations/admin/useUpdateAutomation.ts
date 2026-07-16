import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

// import { ApiClient } from "~/api/api-client";
import { AUTOMATIONS_QUERY_KEY } from "~/api/queries/admin/useAutomations";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { UpdateAutomationBody } from "~/api/queries/admin/automation.types";

interface UpdateAutomationInput {
  automationId: string;
  body: UpdateAutomationBody;
}

/**
 * Updates an existing automation (name, description, status, and/or node tree).
 *
 * Backend contract (expected endpoint):
 *   PATCH /api/automations/:id
 *   Body: UpdateAutomationBody (partial — only changed fields)
 *   Response: { data: AutomationDetail }
 *
 * The builder sends the full `nodes` array on every save.
 * The backend should replace the existing node tree atomically.
 */
export function useUpdateAutomation() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ automationId, body }: UpdateAutomationInput) => {
      // TODO: Uncomment once backend is ready:
      // const { data } = await ApiClient.api.automationControllerUpdate(automationId, body);
      // await queryClient.invalidateQueries({ queryKey: [AUTOMATIONS_QUERY_KEY] });
      // return data;

      // Stub: simulate successful update
      await queryClient.invalidateQueries({ queryKey: [AUTOMATIONS_QUERY_KEY] });
      return { data: { id: automationId, ...body } };
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
