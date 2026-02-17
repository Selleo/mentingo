import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";

import type { CreatePasswordBody, ResetPasswordBody } from "../generated-api";
import type { ApiErrorResponse } from "../types";
import type { AxiosError } from "axios";

type CreateNewPasswordOptions = {
  data: ResetPasswordBody | CreatePasswordBody;
};

type useCreateNewPasswordProps = {
  isCreate?: boolean;
};

export function useCreateNewPassword({ isCreate = true }: useCreateNewPasswordProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (options: CreateNewPasswordOptions) => {
      if (isCreate) {
        const response = await ApiClient.api.authControllerCreatePassword(
          options.data as CreatePasswordBody,
        );

        return response.data;
      }

      const response = await ApiClient.api.authControllerResetPassword(
        options.data as ResetPasswordBody,
      );

      return response.data;
    },
    onError: (error: AxiosError) => {
      const { message } = (error.response?.data as ApiErrorResponse) || {};

      toast({
        variant: "destructive",
        description: message ? t(message) : t("common.error"),
      });
    },
  });
}
