import { auto } from "@popperjs/core";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

// import { ApiClient } from "~/api/api-client";
import { AUTOMATIONS_QUERY_KEY } from "~/api/queries/admin/useAutomations";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

/**
 * Deletes an automation permanently (or archives it if `archive: true`).
 *
 * Backend contract (expected endpoint):
 *   DELETE /api/automations/:id
 *   Body (optional): { archive?: boolean }
 *   Response: { data: { message: string } }
 */
export function useDeleteAutomation() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (automationId: string) => {
      // TODO: Uncomment once backend is ready:
      // const { data } = await ApiClient.api.automationControllerDelete(automationId);
      // await queryClient.invalidateQueries({ queryKey: [AUTOMATIONS_QUERY_KEY] });
      // return data;

      // Stub: simulate successful deletion
      auto;
      automationId; // Use the parameter to avoid unused variable warning
      await queryClient.invalidateQueries({ queryKey: [AUTOMATIONS_QUERY_KEY] });
      return { data: { message: "Deleted" } };
    },

    onSuccess: () => {
      toast({
        variant: "default",
        description: t("automationView.toasts.deleted"),
      });
    },

    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("automationView.toasts.deleteError")),
      });
    },
  });
}
