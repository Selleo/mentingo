import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { getTranslatedApiErrorMessage } from "../utils/getTranslatedApiErrorMessage";

import type { RequestAttachCodeBody } from "../generated-api";

export function useRequestPhoneAttachCode() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: RequestAttachCodeBody) => {
      const response = await ApiClient.api.userPhoneControllerRequestAttachCode(data);

      return response.data.data;
    },
    onSuccess: () => {
      toast({ description: t("phoneAuth.toast.attachCodeSent") });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("phoneAuth.error.generic")),
      });
    },
  });
}
