import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { ALL_EMAIL_TEMPLATES_QUERY_KEY } from "~/api/queries/admin/useAllEmailTemplates";
import { EMAIL_TEMPLATE_QUERY_KEY } from "~/api/queries/admin/useEmailTemplate";
import { queryClient } from "~/api/queryClient";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { UpdateTemplateBody } from "~/api/generated-api";

type UpdateEmailTemplateOptions = {
  id: string;
  data: UpdateTemplateBody;
};

export function useUpdateEmailTemplate() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ id, data }: UpdateEmailTemplateOptions) => {
      const response = await ApiClient.api.emailNotificationTemplatesControllerUpdateTemplate(
        id,
        data,
      );
      return response.data;
    },
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: [ALL_EMAIL_TEMPLATES_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [EMAIL_TEMPLATE_QUERY_KEY, id] });

      toast({
        variant: "default",
        description: t("emailTemplates.toast.updatedSuccessfully"),
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("emailTemplates.toast.updateFailed")),
      });
    },
  });
}
