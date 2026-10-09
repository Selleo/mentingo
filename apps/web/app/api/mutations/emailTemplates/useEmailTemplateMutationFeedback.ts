import { useTranslation } from "react-i18next";

import { AUTOMATIONS_QUERY_KEY } from "~/api/queries/automations.keys";
import { EMAIL_TEMPLATES_QUERY_KEY } from "~/api/queries/useEmailTemplates";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

export function useEmailTemplateMutationFeedback(successKey?: string, invalidate = true) {
  const { t } = useTranslation();
  const { toast } = useToast();

  return {
    onSuccess: async () => {
      if (invalidate)
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: EMAIL_TEMPLATES_QUERY_KEY }),
          queryClient.invalidateQueries({ queryKey: AUTOMATIONS_QUERY_KEY }),
        ]);
      if (successKey) toast({ description: t(successKey) });
    },
    onError: (error: unknown) =>
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("emailTemplates.ui.requestFailed"), {
          allowUntranslatedMessage: false,
        }),
      }),
  };
}
