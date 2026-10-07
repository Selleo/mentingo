import { useTranslation } from "react-i18next";

import { AUTOMATIONS_QUERY_KEY } from "~/api/queries/automations.keys";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

export function useAutomationMutationFeedback(invalidateAutomations = true) {
  const { t } = useTranslation();
  const { toast } = useToast();

  return {
    onSuccess: async () => {
      if (invalidateAutomations) {
        await queryClient.invalidateQueries({ queryKey: AUTOMATIONS_QUERY_KEY });
      }
    },
    onError: (error: unknown) =>
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("automations.requestFailed"), {
          allowUntranslatedMessage: false,
        }),
      }),
  };
}
