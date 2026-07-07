import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { SendBulkPasswordEmailsBody } from "../../generated-api";

export function useBulkSendPasswordEmails() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: SendBulkPasswordEmailsBody) => {
      const response = await ApiClient.api.userControllerSendBulkPasswordEmails(data);

      return response.data;
    },
    onSuccess: ({ data }) => {
      toast({
        variant: "default",
        description: t("changeUserInformationView.toast.passwordEmailsSent", data),
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: t("changeUserInformationView.toast.passwordEmailsError"),
      });
    },
  });
}
