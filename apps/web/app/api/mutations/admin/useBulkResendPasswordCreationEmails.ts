import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { SendBulkPasswordCreationEmailsBody } from "../../generated-api";

export function useBulkResendPasswordCreationEmails() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: SendBulkPasswordCreationEmailsBody) => {
      const response = await ApiClient.api.userControllerSendBulkPasswordCreationEmails(data);

      return response.data;
    },
    onSuccess: ({ data }) => {
      toast({
        variant: "default",
        description: t("changeUserInformationView.toast.passwordCreationEmailsSent", data),
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: t("changeUserInformationView.toast.passwordCreationEmailsError"),
      });
    },
  });
}
