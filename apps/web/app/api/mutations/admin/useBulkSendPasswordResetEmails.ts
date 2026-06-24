import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { SendBulkPasswordResetEmailsBody } from "../../generated-api";

export function useBulkSendPasswordResetEmails() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: SendBulkPasswordResetEmailsBody) => {
      const response = await ApiClient.api.userControllerSendBulkPasswordResetEmails(data);

      return response.data;
    },
    onSuccess: ({ data }) => {
      toast({
        variant: "default",
        description: t("changeUserInformationView.toast.passwordResetEmailsSent", data),
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: t("changeUserInformationView.toast.passwordResetEmailsError"),
      });
    },
  });
}
