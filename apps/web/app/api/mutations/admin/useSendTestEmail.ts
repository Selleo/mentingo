import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import type { SupportedLanguages } from "@repo/shared";

export function useSendTestEmail() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ id, language }: { id: string; language?: SupportedLanguages }) => {
      const response = await ApiClient.api.emailNotificationTemplatesControllerSendTestEmail(id, {
        language,
      });
      return response.data;
    },
    onSuccess: () => {
      toast({
        variant: "default",
        description: t("emailTemplates.toast.testEmailSentSuccessfully"),
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("emailTemplates.toast.testEmailSendFailed"),
        ),
      });
    },
  });
}
