import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { queryClient } from "../queryClient";
export function useCancelPhishingCampaign() {
  const { t } = useTranslation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) =>
      (await ApiClient.api.phishingControllerCancelPhishingCampaign(id)).data.data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["phishing"] });
      toast({ description: t("phishing.cancelSuccess") });
    },
    onError: (error) =>
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("phishing.serviceError")),
      }),
  });
}
