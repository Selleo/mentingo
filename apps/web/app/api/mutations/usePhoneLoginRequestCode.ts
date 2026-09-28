import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { getTranslatedApiErrorMessage } from "../utils/getTranslatedApiErrorMessage";

import type { RequestLoginCodeBody } from "../generated-api";

export function usePhoneLoginRequestCode() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (data: RequestLoginCodeBody) => {
      const response = await ApiClient.api.phoneAuthControllerRequestLoginCode(data);

      return response.data.data;
    },
    onSuccess: ({ message }) => {
      toast({ description: t(message) });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("phoneAuth.error.generic")),
      });
    },
  });
}
