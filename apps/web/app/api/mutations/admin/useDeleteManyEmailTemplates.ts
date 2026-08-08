import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { ALL_EMAIL_TEMPLATES_QUERY_KEY } from "~/api/queries/admin/useAllEmailTemplates";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

export function useDeleteManyEmailTemplates() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (ids: string[]) =>
      await ApiClient.api.emailNotificationTemplatesControllerDeleteManyTemplates(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [ALL_EMAIL_TEMPLATES_QUERY_KEY] });

      toast({
        description: t("emailTemplates.toast.deletedSuccessfully"),
      });
    },
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("emailTemplates.toast.deleteFailed")),
        variant: "destructive",
      });
    },
  });
}
