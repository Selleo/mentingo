import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { ALL_EMAIL_TEMPLATES_QUERY_KEY } from "~/api/queries/admin/useAllEmailTemplates";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

export function useDuplicateEmailTemplate() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (id: string) => {
      const response =
        await ApiClient.api.emailNotificationTemplatesControllerDuplicateTemplate(id);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ALL_EMAIL_TEMPLATES_QUERY_KEY] });

      toast({
        variant: "default",
        description: t("emailTemplates.toast.duplicatedSuccessfully"),
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("emailTemplates.toast.duplicateFailed"),
        ),
      });
    },
  });
}
