import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { AUTOMATIONS_QUERY_KEY } from "~/api/queries/admin/useAutomations";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

export function useDeleteAutomation() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (automationId: string) => {
      const response = await ApiClient.api.automationsControllerDeleteAutomation(automationId);
      await queryClient.invalidateQueries({ queryKey: [AUTOMATIONS_QUERY_KEY] });
      return response.data;
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
