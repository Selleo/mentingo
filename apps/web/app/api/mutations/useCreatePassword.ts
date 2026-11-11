import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";

import { handleAuthSuccess } from "./helpers/handleAuthSuccess";

import type { CreatePasswordBody } from "../generated-api";
import type { ApiErrorResponse } from "../types";
import type { AxiosError } from "axios";

type CreatePasswordOptions = {
  data: CreatePasswordBody;
};

export function useCreatePassword() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (options: CreatePasswordOptions) => {
      const response = await ApiClient.api.authControllerCreatePassword(options.data);
      return response.data;
    },
    onSuccess: handleAuthSuccess,
    onError: (error: AxiosError) => {
      const { message } = (error.response?.data as ApiErrorResponse) || {};

      toast({
        variant: "destructive",
        description: message ? t(message) : t("common.error"),
      });
    },
  });
}
