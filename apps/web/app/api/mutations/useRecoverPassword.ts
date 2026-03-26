import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";

import type { ForgotPasswordBody } from "../generated-api";
import type { ApiErrorResponse } from "../types";
import type { AxiosError } from "axios";

type LoginUserOptions = {
  data: ForgotPasswordBody;
};

export function usePasswordRecovery() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (options: LoginUserOptions) => {
      const response = await ApiClient.api.authControllerForgotPassword(options.data);

      return response.data;
    },
    onError: (error: AxiosError) => {
      const { message } = (error.response?.data as ApiErrorResponse) || {};

      toast({
        variant: "destructive",
        description: message ? t(message) : t("common.error.somethingWentWrong"),
      });
    },
  });
}
