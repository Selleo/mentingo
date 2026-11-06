import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";

import { handleAuthSuccess } from "./helpers/handleAuthSuccess";

import type { RegisterBody } from "../generated-api";
import type { ApiErrorResponse } from "../types";
import type { AxiosError } from "axios";

type RegisterPayload = RegisterBody & {
  formAnswers?: Record<string, boolean>;
};

type RegisterUserOptions = {
  data: RegisterPayload;
};

export function useRegisterUser() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (options: RegisterUserOptions) => {
      const response = await ApiClient.api.authControllerRegister(options.data);

      return response.data;
    },
    onSuccess: handleAuthSuccess,
    onError: (error: AxiosError) => {
      const { message } = error.response?.data as ApiErrorResponse;

      toast({
        variant: "destructive",
        description: t(message),
      });
    },
  });
}
